import { ResourceInventory } from "../resource/ResourceInventory.ts";
import type { ResourceAmounts, ResourceSnapshot } from "../resource/ResourceType.ts";

export type CardTier = 1 | 2 | 3;
export interface PointCardSnapshot {
  readonly cardId: string;
  readonly tier: CardTier;
  readonly victoryPoints: number;
  readonly resourceCost: ResourceSnapshot;
  readonly rewardSkillCard: boolean;
}

export class PointCard {
  readonly #data: PointCardSnapshot;

  constructor(cardId: string, tier: CardTier, resourceCost: ResourceAmounts) {
    if (typeof cardId !== "string" || !cardId.trim()) throw new TypeError("Card ID must not be blank");
    if (tier !== 1 && tier !== 2 && tier !== 3) throw new RangeError("Unknown card tier");
    const inventory = new ResourceInventory(resourceCost);
    const cost = inventory.snapshot();
    const kinds = Object.values(cost).filter(amount => amount > 0).length;
    const total = inventory.total;
    const valid = tier === 1
      ? (kinds === 1 && total === 4) || (kinds >= 2 && kinds <= 3 && total === 5)
      : tier === 2
        ? (kinds === 2 && total === 7) || (kinds >= 3 && kinds <= 4 && total === 8)
        : kinds >= 3 && kinds <= 4 && total === 10;
    if (!valid) throw new RangeError("Card cost does not match tier rules");
    this.#data = Object.freeze({ cardId, tier, victoryPoints: tier, resourceCost: cost, rewardSkillCard: tier === 3 });
  }

  get cardId(): string { return this.#data.cardId; }
  get tier(): CardTier { return this.#data.tier; }
  get cost(): ResourceSnapshot { return this.#data.resourceCost; }
  snapshot(): PointCardSnapshot { return this.#data; }
}
