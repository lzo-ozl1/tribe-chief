import { ResourceInventory } from "./ResourceInventory.ts";
import { RESOURCE_TYPES } from "./ResourceType.ts";
import type { ResourceAmounts, ResourceSnapshot } from "./ResourceType.ts";
import { sumCounts } from "../shared/count.ts";

/** Tracks current visibility per token; all removals consume public stock first. */
export class VisibleResourceInventory {
  #public: ResourceInventory;
  #hidden: ResourceInventory;

  // totals includes public stock. Missing visibility preserves legacy hidden stock.
  constructor(totals: ResourceAmounts = {}, publicResources: ResourceAmounts = {}) {
    const all = new ResourceInventory(totals);
    const visible = new ResourceInventory(publicResources);
    if (!all.has(visible.snapshot())) throw new RangeError("Public resources exceed total resources");
    all.spend(visible.snapshot());
    this.#public = visible;
    this.#hidden = all;
  }

  get total(): number { return sumCounts(this.#public.total, this.#hidden.total); }
  get hiddenCount(): number { return this.#hidden.total; }
  publicSnapshot(): ResourceSnapshot { return this.#public.snapshot(); }
  hiddenSnapshot(): ResourceSnapshot { return this.#hidden.snapshot(); }

  snapshot(): ResourceSnapshot {
    const totals = { ...this.#public.snapshot() };
    for (const type of RESOURCE_TYPES) totals[type] += this.#hidden.get(type);
    return Object.freeze(totals);
  }

  add(totals: ResourceAmounts, publicResources: ResourceAmounts = {}): void {
    const incoming = new VisibleResourceInventory(totals, publicResources);
    sumCounts(this.total, incoming.total);
    const nextPublic = new ResourceInventory(this.#public.snapshot());
    const nextHidden = new ResourceInventory(this.#hidden.snapshot());
    nextPublic.add(incoming.publicSnapshot());
    nextHidden.add(incoming.hiddenSnapshot());
    this.#public = nextPublic;
    this.#hidden = nextHidden;
  }

  /** Transfers existing hidden tokens to public stock without changing totals. */
  reveal(amounts: ResourceAmounts): void {
    const requested = new ResourceInventory(amounts);
    const nextHidden = new ResourceInventory(this.#hidden.snapshot());
    const nextPublic = new ResourceInventory(this.#public.snapshot());
    nextHidden.spend(requested.snapshot());
    nextPublic.add(requested.snapshot());
    this.#hidden = nextHidden;
    this.#public = nextPublic;
  }

  spend(amounts: ResourceAmounts): void {
    const requested = new ResourceInventory(amounts);
    if (!new ResourceInventory(this.snapshot()).has(requested.snapshot())) {
      throw new RangeError("Insufficient resources");
    }
    const nextPublic = { ...this.#public.snapshot() };
    const nextHidden = { ...this.#hidden.snapshot() };
    for (const type of RESOURCE_TYPES) {
      const fromPublic = Math.min(nextPublic[type], requested.get(type));
      nextPublic[type] -= fromPublic;
      nextHidden[type] -= requested.get(type) - fromPublic;
    }
    // Commit only after the complete request has been validated.
    this.#public = new ResourceInventory(nextPublic);
    this.#hidden = new ResourceInventory(nextHidden);
  }
}
