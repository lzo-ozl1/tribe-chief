import { PointCard } from "../card/PointCard.ts";
import type { PointCardSnapshot } from "../card/PointCard.ts";
import type { CardPayment } from "../card/PurchasePayment.ts";
import { VisibleResourceInventory } from "../resource/VisibleResourceInventory.ts";
import { ResourceInventory } from "../resource/ResourceInventory.ts";
import type { ResourceAmounts, ResourceSnapshot } from "../resource/ResourceType.ts";
import { assertCount, sumCounts } from "../shared/count.ts";

export interface TokenAmounts {
  readonly resources?: ResourceAmounts;
  readonly livestock?: number;
}

export interface PlayerInitialState extends TokenAmounts {
  readonly score?: number;
  /** Subset of resources that is currently public; omitted legacy stock stays hidden. */
  readonly publicResources?: ResourceAmounts;
}

export class Player {
  static readonly END_TURN_TOKEN_LIMIT = 15;
  readonly #playerId: string;
  readonly #resources: VisibleResourceInventory;
  #livestockCount: number;
  #score: number;
  #purchasedCards: readonly PointCardSnapshot[] = Object.freeze([]);
  #pendingSkillRewards = 0;

  constructor(playerId: string, initial: PlayerInitialState = {}) {
    if (typeof playerId !== "string" || playerId.trim().length === 0) {
      throw new TypeError("Player ID must not be blank");
    }
    this.#playerId = playerId;
    this.#resources = new VisibleResourceInventory(initial.resources, initial.publicResources);
    this.#livestockCount = initial.livestock ?? 0;
    this.#score = initial.score ?? 0;
    assertCount(this.#livestockCount, "Livestock");
    assertCount(this.#score, "Score");
    sumCounts(this.#resources.total, this.#livestockCount);
  }

  get playerId(): string { return this.#playerId; }
  get basicResources(): ResourceSnapshot { return this.#resources.snapshot(); }
  get publicResources(): ResourceSnapshot { return this.#resources.publicSnapshot(); }
  get hiddenResources(): ResourceSnapshot { return this.#resources.hiddenSnapshot(); }
  get hiddenTokenCount(): number { return this.#resources.hiddenCount; }
  get livestockCount(): number { return this.#livestockCount; }
  get purchasedCards(): readonly PointCardSnapshot[] { return this.#purchasedCards; }
  get pendingSkillRewards(): number { return this.#pendingSkillRewards; }
  get score(): number { return this.#score; }
  get totalTokens(): number { return sumCounts(this.#resources.total, this.#livestockCount); }
  get excessTokens(): number { return Math.max(0, this.totalTokens - Player.END_TURN_TOKEN_LIMIT); }
  get canEndTurn(): boolean { return this.excessTokens === 0; }

  // The application layer will validate turn acquisition choices and timing.
  acquireTokens(amounts: TokenAmounts, publicResources: ResourceAmounts = {}): void {
    const resources = new ResourceInventory(amounts.resources);
    const livestock = amounts.livestock ?? 0;
    assertCount(livestock, "Livestock");
    sumCounts(this.totalTokens, resources.total, livestock);
    this.#resources.add(resources.snapshot(), publicResources);
    this.#livestockCount += livestock;
  }

  /** Trusted domain operation for rules that reveal existing hidden tokens. */
  revealResources(amounts: ResourceAmounts): void {
    this.#resources.reveal(amounts);
  }

  spendTokens(amounts: TokenAmounts): void {
    const resources = new ResourceInventory(amounts.resources);
    const livestock = amounts.livestock ?? 0;
    assertCount(livestock, "Livestock");
    if (livestock > this.#livestockCount) throw new RangeError("Insufficient livestock");
    this.#resources.spend(resources.snapshot());
    this.#livestockCount -= livestock;
  }

  // The player selects exactly the current excess; never discard automatically.
  discardExcessTokens(selection: TokenAmounts): void {
    const resources = new ResourceInventory(selection.resources);
    const livestock = selection.livestock ?? 0;
    const count = sumCounts(resources.total, livestock);
    if (count !== this.excessTokens) throw new RangeError("Select exactly the excess token count");
    this.spendTokens({ resources: resources.snapshot(), livestock });
  }

  assertCanEndTurn(): void {
    if (!this.canEndTurn) throw new RangeError("Discard excess tokens before ending the turn");
  }

  /** Trusted coordinator supplies a validated card payment. */
  purchasePointCard(card: PointCard, payment: CardPayment): void {
    if (!(card instanceof PointCard)) throw new TypeError("Invalid point card");
    if (this.#purchasedCards.some(owned => owned.cardId === card.cardId)) throw new Error("Card already owned");
    const data = card.snapshot();
    if (payment.livestock !== 0 && payment.livestock !== 1) throw new RangeError("Use at most one livestock");
    const unpaid = new ResourceInventory(card.cost);
    unpaid.spend(payment.resources);
    if (unpaid.total !== payment.livestock * 2) throw new RangeError("Payment must match the printed cost");
    const nextScore = sumCounts(this.#score, data.victoryPoints);
    const nextRewards = sumCounts(this.#pendingSkillRewards, data.rewardSkillCard ? 1 : 0);
    const nextCards = Object.freeze([...this.#purchasedCards, data]);
    this.spendTokens(payment);
    this.#score = nextScore;
    this.#pendingSkillRewards = nextRewards;
    this.#purchasedCards = nextCards;
  }

  addScore(points: number): void {
    this.#score = sumCounts(this.#score, points);
  }
}
