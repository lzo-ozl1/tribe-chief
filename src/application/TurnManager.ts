import { SkillDeck, createBetaSkillDeck } from "../domain/skill/SkillDeck.ts";
import type { SkillType, SkillSnapshot } from "../domain/skill/SkillInventory.ts";
import type { SkillAttackTarget, SkillActionResult, PrivatePeek } from "../domain/skill/SkillAction.ts";
import { Market } from "../domain/card/Market.ts";
import type { MarketSlot } from "../domain/card/Market.ts";
import { createBetaDeck } from "../domain/card/BetaDeck.ts";
import { assertLivestockPolicy } from "../domain/card/PurchasePayment.ts";
import type { LivestockPolicy } from "../domain/card/PurchasePayment.ts";
import type { PointCard, PointCardSnapshot } from "../domain/card/PointCard.ts";
import type { CardPurchaseResult } from "../domain/card/CardPurchase.ts";
import type { ResourceAmounts } from "../domain/resource/ResourceType.ts";
import type { BasicAttackTarget, BasicAttackResult } from "../domain/combat/BasicAttackResolver.ts";
import { Player } from "../domain/player/Player.ts";
import type { PlayerInitialState, TokenAmounts } from "../domain/player/Player.ts";
import type { ResourceSnapshot } from "../domain/resource/ResourceType.ts";
import type { AcquisitionChoice, AcquisitionDisclosure } from "../domain/resource/ResourceAcquisition.ts";
import { Turn } from "../domain/turn/Turn.ts";
import type { PublicTurnState } from "../domain/turn/Turn.ts";
import { sumCounts } from "../domain/shared/count.ts";

export interface TurnManagerOptions {
  readonly deck?: readonly PointCard[];
  readonly livestockPolicy?: LivestockPolicy;
  readonly skillDeck?: readonly SkillType[];
}

export interface PlayerSetup extends PlayerInitialState {
  readonly playerId: string;
}

export interface PublicPlayerState {
  readonly playerId: string;
  readonly score: number;
  readonly purchasedCards: readonly PointCardSnapshot[];
  readonly pendingSkillRewards: number;
  readonly skillCardCount: number;
  readonly livestockCount: number;
  readonly publicResources: ResourceSnapshot;
  readonly hiddenTokenCount: number;
  readonly totalTokens: number;
}

export interface PrivatePlayerState extends PublicPlayerState {
  readonly basicResources: ResourceSnapshot;
  readonly hiddenResources: ResourceSnapshot;
  readonly excessTokens: number;
  readonly skills: SkillSnapshot;
  readonly peeks: readonly (PrivatePeek & { readonly turnNumber: number })[];
}

export interface PublicTurnManagerState {
  readonly turnNumber: number;
  readonly round: number;
  readonly currentTurn: PublicTurnState;
  readonly market: readonly MarketSlot[];
  readonly skillDeckRemaining: number;
  readonly livestockPolicy: LivestockPolicy;
  readonly players: readonly PublicPlayerState[];
}

/** Uses the caller-supplied player order; does not select a starting player. */
export class TurnManager {
  readonly #players: readonly Player[];
  readonly #market: Market;
  readonly #skillDeck: SkillDeck;
  readonly #peeks = new Map<string, readonly (PrivatePeek & { readonly turnNumber: number })[]>();
  readonly #livestockPolicy: LivestockPolicy;
  #currentPlayerIndex = 0;
  #turnNumber = 1;
  #round = 1;
  #turn: Turn;

  constructor(setup: readonly PlayerSetup[], options: TurnManagerOptions = {}) {
    if (!Array.isArray(setup) || setup.length < 2 || setup.length > 6) {
      throw new RangeError("A turn manager requires 2 to 6 players");
    }
    const players = Array.from(setup, entry => new Player(entry.playerId, entry));
    if (new Set(players.map(player => player.playerId)).size !== players.length) {
      throw new Error("Player IDs must be unique");
    }
    const policy = options.livestockPolicy ?? "BETA_SPLIT";
    assertLivestockPolicy(policy);
    this.#livestockPolicy = policy;
    this.#skillDeck = new SkillDeck(options.skillDeck ?? createBetaSkillDeck());
    this.#market = new Market(players.length, options.deck ?? createBetaDeck());
    this.#players = players;
    this.#turn = new Turn(players[0]!);
  }

  publicState(): PublicTurnManagerState {
    return Object.freeze({
      turnNumber: this.#turnNumber,
      round: this.#round,
      currentTurn: this.#turn.publicState(),
      market: this.#market.snapshot(),
      skillDeckRemaining: this.#skillDeck.remaining,
      livestockPolicy: this.#livestockPolicy,
      players: Object.freeze(this.#players.map(player => Object.freeze({
        playerId: player.playerId,
        score: player.score,
        purchasedCards: player.purchasedCards,
        pendingSkillRewards: player.pendingSkillRewards,
        skillCardCount: player.skillCardCount,
        livestockCount: player.livestockCount,
        publicResources: player.publicResources,
        hiddenTokenCount: player.hiddenTokenCount,
        totalTokens: player.totalTokens,
      }))),
    });
  }

  /** Trusted engine/owner view. Network callers need separate authentication. */
  privatePlayerState(playerId: string): PrivatePlayerState {
    const player = this.#players.find(candidate => candidate.playerId === playerId);
    if (!player) throw new Error("Unknown player");
    return Object.freeze({
      playerId: player.playerId,
      score: player.score,
        purchasedCards: player.purchasedCards,
        pendingSkillRewards: player.pendingSkillRewards,
        skillCardCount: player.skillCardCount,
      livestockCount: player.livestockCount,
      publicResources: player.publicResources,
      hiddenTokenCount: player.hiddenTokenCount,
      totalTokens: player.totalTokens,
      basicResources: player.basicResources,
      hiddenResources: player.hiddenResources,
      excessTokens: player.excessTokens,
      skills: player.skills,
      peeks: this.#peeks.get(playerId) ?? Object.freeze([]),
    });
  }

  attack(playerId: string, defenderId: string, target: BasicAttackTarget): BasicAttackResult {
    const defender = this.#players.find(player => player.playerId === defenderId);
    if (!defender) throw new Error("Unknown defender");
    return this.#turn.attack(playerId, defender, target);
  }

  attackSkill(playerId: string, defenderId: string, target: SkillAttackTarget): SkillActionResult {
    return this.#turn.attackSkill(playerId, this.#findPlayer(defenderId), target);
  }

  defenseOptions(playerId: string): Readonly<{ actionId: number; canUseDefenseSkill: boolean }> {
    return this.#turn.defenseOptions(playerId);
  }

  respondDefense(playerId: string, turnNumber: number, actionId: number, useSkill: boolean): BasicAttackResult | SkillActionResult {
    if (turnNumber !== this.#turnNumber) throw new Error("Stale defense turn");
    return this.#turn.respondDefense(playerId, actionId, useSkill);
  }

  peekHidden(playerId: string, targetId: string): PrivatePeek {
    const { peek } = this.#turn.informationSkill(playerId, this.#findPlayer(targetId), "PEEK");
    const record = Object.freeze({ ...peek!, turnNumber: this.#turnNumber });
    this.#peeks.set(playerId, Object.freeze([...(this.#peeks.get(playerId) ?? []), record]));
    return record;
  }

  revealHidden(playerId: string, targetId: string, faceDownSlot: number): SkillActionResult {
    return this.#turn.informationSkill(playerId, this.#findPlayer(targetId), "REVEAL", faceDownSlot).action;
  }

  #findPlayer(playerId: string): Player {
    const player = this.#players.find(p => p.playerId === playerId);
    if (!player) throw new Error("Unknown player");
    return player;
  }

  acquire(playerId: string, choice: AcquisitionChoice): AcquisitionDisclosure {
    return this.#turn.acquire(playerId, choice);
  }

  purchase(playerId: string, cardId: string, replacement: ResourceAmounts = {}): CardPurchaseResult {
    const player = this.#players.find(p => p.playerId === playerId);
    // Reserve capacity before a successful purchase could award a card.
    if (player && this.#market.find(cardId).tier === 3 && this.#skillDeck.remaining > 0) sumCounts(player.skillCardCount, 1);
    const result = this.#turn.purchase(playerId, this.#market, cardId, replacement, this.#livestockPolicy);
    if (player && result.card.rewardSkillCard) {
      const skill = this.#skillDeck.peek();
      if (skill !== null) { player.receiveSkillReward(skill); this.#skillDeck.draw(); }
    }
    return result;
  }

  endTurn(playerId: string, discard?: TokenAmounts): PublicTurnState {
    const nextIndex = (this.#currentPlayerIndex + 1) % this.#players.length;
    const nextTurnNumber = sumCounts(this.#turnNumber, 1);
    const nextRound = sumCounts(this.#round, nextIndex === 0 ? 1 : 0);
    const ended = this.#turn.end(playerId, discard);
    this.#currentPlayerIndex = nextIndex;
    this.#turnNumber = nextTurnNumber;
    this.#round = nextRound;
    this.#turn = new Turn(this.#players[nextIndex]!);
    return ended;
  }
}
