export const ResourceType = Object.freeze({
  FIRE: "FIRE", WATER: "WATER", STONE: "STONE", WOOD: "WOOD", FOOD: "FOOD",
} as const);

export type ResourceType = typeof ResourceType[keyof typeof ResourceType];
export const RESOURCE_TYPES: readonly ResourceType[] = Object.freeze(Object.values(ResourceType));
export type ResourceAmounts = Readonly<Partial<Record<ResourceType, number>>>;
export type ResourceSnapshot = Readonly<Record<ResourceType, number>>;

export function assertResourceType(value: unknown): asserts value is ResourceType {
  if (!RESOURCE_TYPES.includes(value as ResourceType)) {
    throw new TypeError("Unknown resource type");
  }
}
