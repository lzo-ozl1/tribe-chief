import { assertResourceType } from "./ResourceType.ts";
import type { ResourceType, ResourceAmounts } from "./ResourceType.ts";
import type { TokenAmounts } from "../player/Player.ts";

export type AcquisitionChoice =
  | { readonly kind: "DISTINCT_THREE"; readonly resources: readonly [ResourceType, ResourceType, ResourceType]; readonly revealedResource: ResourceType }
  | { readonly kind: "PAIR_AND_LIVESTOCK"; readonly resource: ResourceType };

export interface AcquisitionDisclosure {
  readonly resourceType: ResourceType;
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
    let resourceType: ResourceType;
    let livestock: 0 | 1;
    switch (choice.kind) {
      case "DISTINCT_THREE": {
        if (!Array.isArray(choice.resources) || choice.resources.length !== 3) {
          throw new RangeError("Choose exactly three different resources");
        }
        const selected = [...choice.resources];
        selected.forEach(assertResourceType);
        if (new Set(selected).size !== 3) throw new RangeError("Resources must be different");
        assertResourceType(choice.revealedResource);
        if (!selected.includes(choice.revealedResource)) {
          throw new RangeError("Reveal one of the selected resources");
        }
        resources = Object.fromEntries(selected.map(type => [type, 1]));
        resourceType = choice.revealedResource;
        livestock = 0;
        break;
      }
      case "PAIR_AND_LIVESTOCK":
        assertResourceType(choice.resource);
        resources = { [choice.resource]: 2 };
        resourceType = choice.resource;
        livestock = 1;
        break;
      default:
        throw new TypeError("Unknown acquisition choice");
    }
    this.#tokens = Object.freeze({ resources: Object.freeze(resources), livestock });
    this.#disclosure = Object.freeze({ resourceType, livestockGained: livestock });
  }

  /** Trusted engine data; includes hidden choices and must not be broadcast. */
  get tokens(): TokenAmounts { return this.#tokens; }
  get disclosure(): AcquisitionDisclosure { return this.#disclosure; }
}
