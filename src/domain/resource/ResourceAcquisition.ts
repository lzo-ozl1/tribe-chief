import { assertResourceType } from "./ResourceType.ts";
import type { ResourceType, ResourceAmounts } from "./ResourceType.ts";
import type { TokenAmounts } from "../player/Player.ts";

export type AcquisitionChoice =
  | { readonly kind: "DISTINCT_THREE"; readonly resources: readonly [ResourceType, ResourceType, ResourceType]; readonly revealedResources: readonly [ResourceType, ResourceType] }
  | { readonly kind: "PAIR_AND_LIVESTOCK"; readonly resource: ResourceType };

export interface AcquisitionDisclosure {
  readonly resourceTypes: readonly [ResourceType] | readonly [ResourceType, ResourceType];
  readonly livestockGained: 0 | 1;
}

/** Validates a complete acquisition before any player state changes. */
export class ResourceAcquisition {
  readonly #tokens: TokenAmounts;
  readonly #disclosure: AcquisitionDisclosure;

  constructor(choice: AcquisitionChoice) {
    if (choice === null || typeof choice !== "object") {
      throw new TypeError("Acquisition choice must be an object");
    }
    let resources: ResourceAmounts;
    let resourceTypes: readonly [ResourceType] | readonly [ResourceType, ResourceType];
    let livestock: 0 | 1;
    switch (choice.kind) {
      case "DISTINCT_THREE": {
        if (!Array.isArray(choice.resources) || choice.resources.length !== 3) {
          throw new RangeError("Choose exactly three different resources");
        }
        const selected = [...choice.resources];
        selected.forEach(assertResourceType);
        if (new Set(selected).size !== 3) throw new RangeError("Resources must be different");
        if (!Array.isArray(choice.revealedResources) || choice.revealedResources.length !== 2) {
          throw new RangeError("Reveal exactly two different selected resources");
        }
        const revealed = [...choice.revealedResources];
        revealed.forEach(assertResourceType);
        if (new Set(revealed).size !== 2 || !revealed.every(type => selected.includes(type))) {
          throw new RangeError("Reveal two different resources from the selected three");
        }
        resources = Object.fromEntries(selected.map(type => [type, 1]));
        resourceTypes = [revealed[0]!, revealed[1]!];
        livestock = 0;
        break;
      }
      case "PAIR_AND_LIVESTOCK":
        assertResourceType(choice.resource);
        resources = { [choice.resource]: 2 };
        resourceTypes = [choice.resource];
        livestock = 1;
        break;
      default:
        throw new TypeError("Unknown acquisition choice");
    }
    this.#tokens = Object.freeze({ resources: Object.freeze(resources), livestock });
    this.#disclosure = Object.freeze({ resourceTypes: Object.freeze(resourceTypes), livestockGained: livestock });
  }

  /** Trusted engine data; includes hidden choices and must not be broadcast. */
  get tokens(): TokenAmounts { return this.#tokens; }
  get disclosure(): AcquisitionDisclosure { return this.#disclosure; }
}
