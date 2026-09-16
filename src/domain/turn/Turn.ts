import { RESOURCE_TYPES } from "../resource/ResourceType.ts";
import { randomUnit } from "../skill/SkillDeck.ts";
import type { PrivatePeek } from "../skill/SkillAction.ts";
import { assertSkillAttackTarget, targetCount, removeTarget } from "../skill/SkillAction.ts";
import type { SkillAttackTarget, SkillActionResult } from "../skill/SkillAction.ts";
import { CardPurchase } from "../card/CardPurchase.ts";
import type { CardPurchaseResult } from "../card/CardPurchase.ts";
import type { LivestockPolicy } from "../card/PurchasePayment.ts";
import type { ResourceAmounts } from "../resource/ResourceType.ts";
import { Market } from "../card/Market.ts";
import { BasicAttackResolver } from "../combat/BasicAttackResolver.ts";
import type { BasicAttackTarget, BasicAttackResult } from "../combat/BasicAttackResolver.ts";
import { Player } from "../player/Player.ts";
import type { TokenAmounts } from "../player/Player.ts";
import { ResourceAcquisition } from "../resource/ResourceAcquisition.ts";
import type { AcquisitionChoice, AcquisitionDisclosure } from "../resource/ResourceAcquisition.ts";

export type TurnPhase = "AWAITING_ACQUISITION" | "AFTER_ACQUISITION" | "ENDED";

export interface PublicTurnState {
  readonly playerId: string;
  readonly phase: TurnPhase;
  readonly acquisition: AcquisitionDisclosure | null;
  /** Timing/frequency only; FIRE holdings are checked when an attack is requested. */
  readonly attackAvailable: boolean;
  readonly attack: BasicAttackResult | null;
  readonly purchaseAvailable: boolean;
  readonly purchase: CardPurchaseResult | null;
  readonly pendingDefense: PendingDefense | null;
  readonly skillActions: readonly SkillActionResult[];
}

export interface PendingDefense {
  readonly actionId: number;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly kind: "BASIC" | "SKILL";
  readonly targetResource: SkillAttackTarget;
}
type PendingInternal = { readonly public: PendingDefense; readonly defender: Player };

/** Owns the action order and locks progression while a defender chooses. */
export class Turn {
  readonly #player: Player;
  readonly #attackResolver = new BasicAttackResolver();
  #attack: BasicAttackResult | null = null;
  #purchase: CardPurchaseResult | null = null;
  #pending: PendingInternal | null = null;
  #skillActions: readonly SkillActionResult[] = Object.freeze([]);
  #actionNumber = 0;
  #basicClosed = false;
  #phase: TurnPhase = "AWAITING_ACQUISITION";
  #acquisition: AcquisitionDisclosure | null = null;

  constructor(player: Player) {
    this.#player = player;
  }

  publicState(): PublicTurnState {
    return Object.freeze({
      playerId: this.#player.playerId,
      phase: this.#phase,
      acquisition: this.#acquisition,
      attackAvailable: this.#phase === "AWAITING_ACQUISITION" && this.#attack === null && !this.#basicClosed && this.#pending === null,
      attack: this.#attack,
      purchaseAvailable: this.#phase === "AFTER_ACQUISITION" && this.#purchase === null && this.#pending === null,
      purchase: this.#purchase,
      pendingDefense: this.#pending?.public ?? null,
      skillActions: this.#skillActions,
    });
  }

  attack(playerId: string, defender: Player, target: BasicAttackTarget): BasicAttackResult {
    this.#assertActorAndPhase(playerId, "AWAITING_ACQUISITION");
    if (this.#attack !== null || this.#basicClosed) throw new Error("Attack opportunity already used");
    if (target !== "WOOD" && target !== "FOOD") throw new TypeError("Invalid basic target");
    if (defender.playerId === playerId) throw new Error("Cannot attack yourself");
    if (this.#player.basicResources.FIRE < 1) throw new Error("A basic attack requires FIRE");
    const defense = target === "WOOD" ? "WATER" : "STONE";
    if (defender.basicResources[target] > 0 && defender.basicResources[defense] === 0 && defender.skillCardCount > 0) {
      const pending = Object.freeze({ actionId: ++this.#actionNumber, attackerId: playerId,
        defenderId: defender.playerId, kind: "BASIC" as const, targetResource: target });
      this.#pending = { public: pending, defender };
      this.#attack = Object.freeze({ attackerId: playerId, defenderId: defender.playerId,
        targetResource: target, outcome: "PENDING_DEFENSE" });
      return this.#attack;
    }
    const result = this.#attackResolver.resolve(this.#player, defender, target);
    this.#attack = result;
    return result;
  }

  attackSkill(playerId: string, defender: Player, target: SkillAttackTarget): SkillActionResult {
    this.assertSkillAction(playerId, defender);
    assertSkillAttackTarget(target);
    if (!this.#player.hasSkill("ATTACK")) throw new Error("Missing attack skill");
    const exists = targetCount(defender, target) > 0;
    const waits = exists && defender.skillCardCount > 0;
    const actionId = this.#actionNumber + 1;
    this.#player.spendSkill("ATTACK");
    this.#actionNumber = actionId;
    this.#basicClosed = true;
    const result: SkillActionResult = Object.freeze({ actionId, playerId, targetPlayerId: defender.playerId,
      skill: "ATTACK", targetResource: target, outcome: !exists ? "VOID" : waits ? "PENDING_DEFENSE" : "HIT",
      leaderScoreEligible: false });
    if (waits) this.#pending = { public: Object.freeze({ actionId, attackerId: playerId,
      defenderId: defender.playerId, kind: "SKILL", targetResource: target }), defender };
    else if (exists) removeTarget(defender, target);
    this.#skillActions = Object.freeze([...this.#skillActions, result]);
    return result;
  }

  informationSkill(playerId: string, target: Player, skill: "PEEK" | "REVEAL", slot?: number): Readonly<{ action: SkillActionResult; peek?: PrivatePeek }> {
    this.assertSkillAction(playerId, target);
    if (skill !== "PEEK" && skill !== "REVEAL") throw new TypeError("Invalid information skill");
    if (!this.#player.hasSkill(skill)) throw new Error("Missing information skill");
    if (target.hiddenTokenCount === 0) throw new Error("Target has no hidden tokens");
    if (skill === "REVEAL" && (!Number.isSafeInteger(slot) || slot! < 0 || slot! >= target.hiddenTokenCount)) {
      throw new RangeError("Select a face-down token slot");
    }
    const actionId = this.#actionNumber + 1;
    let revealed: typeof RESOURCE_TYPES[number] | undefined;
    const hidden = target.hiddenResources;
    if (skill === "REVEAL") {
      // Secretly rotate a uniformly selected offset around the caller's face-down slot.
      // Every token (not every resource type) has equal probability; no bag is exposed.
      let index = (Math.floor(randomUnit() * target.hiddenTokenCount) + slot!) % target.hiddenTokenCount;
      for (const type of RESOURCE_TYPES) {
        if (index < hidden[type]) { revealed = type; break; }
        index -= hidden[type];
      }
    }
    this.#player.spendSkill(skill);
    if (revealed) target.revealResources({ [revealed]: 1 });
    this.#basicClosed = true;
    this.#actionNumber = actionId;
    const action: SkillActionResult = Object.freeze({ actionId, playerId, targetPlayerId: target.playerId,
      skill, outcome: skill === "PEEK" ? "PEEKED" : "REVEALED",
      ...(revealed ? { targetResource: revealed } : {}), leaderScoreEligible: false });
    this.#skillActions = Object.freeze([...this.#skillActions, action]);
    return skill === "PEEK"
      ? Object.freeze({ action, peek: Object.freeze({ actionId, targetPlayerId: target.playerId, hiddenResources: hidden }) })
      : Object.freeze({ action });
  }

  defenseOptions(playerId: string): Readonly<{ actionId: number; canUseDefenseSkill: boolean }> {
    const pending = this.#pending;
    if (!pending || pending.public.defenderId !== playerId) throw new Error("Not the pending defender");
    return Object.freeze({ actionId: pending.public.actionId, canUseDefenseSkill: pending.defender.hasSkill("DEFENSE") });
  }

  respondDefense(playerId: string, actionId: number, useSkill: boolean): BasicAttackResult | SkillActionResult {
    const pending = this.#pending;
    if (!pending || pending.public.defenderId !== playerId) throw new Error("Not the pending defender");
    if (pending.public.actionId !== actionId) throw new Error("Stale defense response");
    if (typeof useSkill !== "boolean") throw new TypeError("Defense choice must be boolean");
    if (useSkill && !pending.defender.hasSkill("DEFENSE")) throw new Error("Missing defense skill");
    let result: BasicAttackResult | SkillActionResult;
    if (pending.public.kind === "BASIC") {
      result = this.#attackResolver.resolve(this.#player, pending.defender, pending.public.targetResource as BasicAttackTarget, useSkill);
      this.#attack = result;
    } else {
      if (useSkill) pending.defender.spendSkill("DEFENSE");
      else removeTarget(pending.defender, pending.public.targetResource);
      result = Object.freeze({ actionId, playerId: this.#player.playerId, targetPlayerId: playerId,
        skill: "ATTACK", targetResource: pending.public.targetResource, outcome: useSkill ? "DEFENDED" : "HIT",
        ...(useSkill ? { defenseSkillUsed: true as const } : {}), leaderScoreEligible: false });
      this.#skillActions = Object.freeze(this.#skillActions.map(action => action.actionId === actionId ? result as SkillActionResult : action));
    }
    this.#pending = null;
    return result;
  }

  assertSkillAction(playerId: string, target: Player): void {
    if (playerId !== this.#player.playerId) throw new Error("Not the active player");
    if (this.#phase === "ENDED") throw new Error("Action is not allowed in the current turn phase");
    if (this.#pending) throw new Error("Resolve pending defense first");
    if (target.playerId === playerId) throw new Error("Cannot target yourself");
  }

  acquire(playerId: string, choice: AcquisitionChoice): AcquisitionDisclosure {
    this.#assertActorAndPhase(playerId, "AWAITING_ACQUISITION");
    const acquisition = new ResourceAcquisition(choice);
    this.#player.acquireTokens(acquisition.tokens, acquisition.publicResources);
    this.#acquisition = acquisition.disclosure;
    this.#phase = "AFTER_ACQUISITION";
    return this.#acquisition;
  }

  purchase(playerId: string, market: Market, cardId: string, replacement: ResourceAmounts = {}, policy: LivestockPolicy = "BETA_SPLIT"): CardPurchaseResult {
    this.#assertActorAndPhase(playerId, "AFTER_ACQUISITION");
    if (this.#purchase !== null) throw new Error("Only one point card may be purchased per turn");
    const result = CardPurchase.execute(this.#player, market, cardId, replacement, policy);
    this.#purchase = result;
    return result;
  }

  end(playerId: string, discard?: TokenAmounts): PublicTurnState {
    this.#assertActorAndPhase(playerId, "AFTER_ACQUISITION");
    if (discard !== undefined) this.#player.discardExcessTokens(discard);
    this.#player.assertCanEndTurn();
    this.#phase = "ENDED";
    return this.publicState();
  }

  #assertActorAndPhase(playerId: string, phase: TurnPhase): void {
    if (playerId !== this.#player.playerId) throw new Error("Not the active player");
    if (this.#pending) throw new Error("Resolve pending defense first");
    if (this.#phase !== phase) throw new Error("Action is not allowed in the current turn phase");
  }
}
