import { PointCard } from "./PointCard.ts";
import type { CardTier, PointCardSnapshot } from "./PointCard.ts";

export interface MarketSlot {
  readonly tier: CardTier;
  readonly card: PointCardSnapshot | null;
}

export class Market {
  readonly #slots: { tier: CardTier; card: PointCard | null }[] = [];
  readonly #decks: Record<CardTier, PointCard[]> = { 1: [], 2: [], 3: [] };
  readonly #next: Record<CardTier, number> = { 1: 0, 2: 0, 3: 0 };

  constructor(playerCount: number, cards: readonly PointCard[]) {
    if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 6) throw new RangeError("Market requires 2 to 6 players");
    if (!Array.isArray(cards)) throw new TypeError("Deck must be an array");
    const seen = new Set<string>();
    for (const card of cards) {
      if (!(card instanceof PointCard)) throw new TypeError("Deck entries must be point cards");
      if (seen.has(card.cardId)) throw new Error("Duplicate card ID");
      seen.add(card.cardId);
      this.#decks[card.tier].push(card);
    }
    const sizes = playerCount <= 3 ? [3, 2, 1] : [4, 3, 2];
    for (const tier of [1, 2, 3] as const) {
      for (let slot = 0; slot < sizes[tier - 1]!; slot++) this.#slots.push({ tier, card: this.#draw(tier) });
    }
  }

  snapshot(): readonly MarketSlot[] {
    return Object.freeze(this.#slots.map(slot => Object.freeze({ tier: slot.tier, card: slot.card?.snapshot() ?? null })));
  }

  find(cardId: string): PointCard {
    const card = this.#slots.find(slot => slot.card?.cardId === cardId)?.card;
    if (!card) throw new Error("Card is not in the public market");
    return card;
  }

  /** Trusted purchase coordinator calls this only after payment succeeds. */
  take(cardId: string): void {
    const slot = this.#slots.find(entry => entry.card?.cardId === cardId);
    if (!slot) throw new Error("Card is not in the public market");
    slot.card = this.#draw(slot.tier);
  }

  #draw(tier: CardTier): PointCard | null {
    const card = this.#decks[tier][this.#next[tier]];
    if (!card) return null;
    this.#next[tier]++;
    return card;
  }
}
