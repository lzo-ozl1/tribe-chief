import { PointCard } from "./PointCard.ts";
import type { CardTier } from "./PointCard.ts";
import { RESOURCE_TYPES } from "../resource/ResourceType.ts";

/** Temporary symmetric cost fixtures, not a final balanced card list. */
export function createBetaDeck(seed = 20260916): readonly PointCard[] {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("Seed must be uint32");
  const patterns: readonly (readonly [CardTier, readonly number[]])[] = [
    [1, [4]], [1, [3, 2]], [1, [2, 2, 1]],
    [2, [4, 3]], [2, [3, 3, 2]], [2, [2, 2, 2, 2]],
    [3, [4, 3, 3]], [3, [3, 3, 2, 2]],
  ];
  const cards: PointCard[] = [];
  patterns.forEach(([tier, amounts], pattern) => {
    for (let offset = 0; offset < RESOURCE_TYPES.length; offset++) {
      const cost = Object.fromEntries(amounts.map((amount, index) => [RESOURCE_TYPES[(offset + index) % RESOURCE_TYPES.length]!, amount]));
      cards.push(new PointCard("beta-" + tier + "-" + pattern + "-" + offset, tier, cost));
    }
  });
  let state = seed >>> 0;
  for (let i = cards.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((state / 0x100000000) * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return Object.freeze(cards);
}
