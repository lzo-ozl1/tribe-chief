import { RESOURCE_TYPES, assertResourceType } from "./ResourceType.ts";
import type { ResourceType, ResourceAmounts, ResourceSnapshot } from "./ResourceType.ts";
import { assertCount, sumCounts } from "../shared/count.ts";

export class ResourceInventory {
  #counts: Record<ResourceType, number>;

  constructor(initial: ResourceAmounts = {}) {
    if (initial === null || typeof initial !== "object" || Array.isArray(initial)) {
      throw new TypeError("Resources must be an object");
    }
    this.#counts = { FIRE: 0, WATER: 0, STONE: 0, WOOD: 0, FOOD: 0 };
    for (const [type, amount] of Object.entries(initial)) {
      assertResourceType(type);
      assertCount(amount, type);
      this.#counts[type] = amount;
    }
    sumCounts(...Object.values(this.#counts));
  }

  get(type: ResourceType): number {
    assertResourceType(type);
    return this.#counts[type];
  }

  get total(): number {
    return sumCounts(...Object.values(this.#counts));
  }

  snapshot(): ResourceSnapshot {
    return Object.freeze({ ...this.#counts });
  }

  has(amounts: ResourceAmounts): boolean {
    const requested = new ResourceInventory(amounts);
    return RESOURCE_TYPES.every(type => this.#counts[type] >= requested.get(type));
  }

  add(amounts: ResourceAmounts): void {
    const incoming = new ResourceInventory(amounts);
    sumCounts(this.total, incoming.total);
    const next = { ...this.#counts };
    for (const type of RESOURCE_TYPES) next[type] += incoming.get(type);
    this.#counts = next;
  }

  spend(amounts: ResourceAmounts): void {
    const requested = new ResourceInventory(amounts);
    if (!this.has(requested.snapshot())) throw new RangeError("Insufficient resources");
    const next = { ...this.#counts };
    for (const type of RESOURCE_TYPES) next[type] -= requested.get(type);
    this.#counts = next;
  }
}
