import { RESOURCE_TYPES } from "../resource/ResourceType.ts";
import type { ResourceAmounts, ResourceSnapshot } from "../resource/ResourceType.ts";
import { ResourceInventory } from "../resource/ResourceInventory.ts";
import { PointCard } from "./PointCard.ts";

export type LivestockPolicy = "BETA_SPLIT" | "SAME_RESOURCE";
export interface CardPayment {
  readonly resources: ResourceSnapshot;
  readonly livestock: 0 | 1;
}

export function assertLivestockPolicy(policy: unknown): asserts policy is LivestockPolicy {
  if (policy !== "BETA_SPLIT" && policy !== "SAME_RESOURCE") throw new TypeError("Unknown livestock policy");
}

export class PurchasePayment {
  /** Specify the two printed cost units replaced by exactly one livestock. */
  static plan(card: PointCard, replacement: ResourceAmounts = {}, policy: LivestockPolicy = "BETA_SPLIT"): CardPayment {
    assertLivestockPolicy(policy);
    const substitute = new ResourceInventory(replacement);
    const count = substitute.total;
    if (count !== 0 && count !== 2) throw new RangeError("One livestock replaces exactly two resource units");
    if (policy === "SAME_RESOURCE" && count === 2 &&
        RESOURCE_TYPES.filter(type => substitute.get(type) > 0).length !== 1) {
      throw new RangeError("Livestock must replace two of the same resource");
    }
    const remaining = new ResourceInventory(card.cost);
    remaining.spend(substitute.snapshot());
    return Object.freeze({ resources: remaining.snapshot(), livestock: count === 2 ? 1 : 0 });
  }

  /** All legal payment alternatives, including payment without livestock. */
  static options(card: PointCard, policy: LivestockPolicy = "BETA_SPLIT"): readonly CardPayment[] {
    assertLivestockPolicy(policy);
    const plans: CardPayment[] = [this.plan(card, {}, policy)];
    for (let i = 0; i < RESOURCE_TYPES.length; i++) {
      for (let j = i; j < RESOURCE_TYPES.length; j++) {
        if (policy === "SAME_RESOURCE" && i !== j) continue;
        const a = RESOURCE_TYPES[i]!;
        const b = RESOURCE_TYPES[j]!;
        if (card.cost[a] < (a === b ? 2 : 1) || card.cost[b] < 1) continue;
        const replacement = a === b ? { [a]: 2 } : { [a]: 1, [b]: 1 };
        plans.push(this.plan(card, replacement, policy));
      }
    }
    return Object.freeze(plans);
  }
}
