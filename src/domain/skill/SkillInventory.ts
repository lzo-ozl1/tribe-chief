import { assertCount, sumCounts } from "../shared/count.ts";

export const SKILL_TYPES = Object.freeze(["ATTACK", "DEFENSE", "PEEK", "REVEAL"] as const);
export type SkillType = typeof SKILL_TYPES[number];
export type SkillAmounts = Partial<Record<SkillType, number>>;
export type SkillSnapshot = Readonly<Record<SkillType, number>>;

export function assertSkillType(type: unknown): asserts type is SkillType {
  if (!SKILL_TYPES.includes(type as SkillType)) throw new TypeError("Unknown skill type");
}

/** Private hand contents; only total count belongs in a public player view. */
export class SkillInventory {
  #counts: Record<SkillType, number>;

  constructor(initial: SkillAmounts = {}) {
    if (!initial || typeof initial !== "object" || Array.isArray(initial)) throw new TypeError("Invalid skill amounts");
    for (const key of Object.keys(initial)) {
      assertSkillType(key);
      assertCount(initial[key]!, "Skill count");
    }
    this.#counts = { ATTACK: initial.ATTACK ?? 0, DEFENSE: initial.DEFENSE ?? 0, PEEK: initial.PEEK ?? 0, REVEAL: initial.REVEAL ?? 0 };
    sumCounts(...Object.values(this.#counts));
  }

  get total(): number { return sumCounts(...Object.values(this.#counts)); }
  snapshot(): SkillSnapshot { return Object.freeze({ ...this.#counts }); }
  has(type: SkillType): boolean { assertSkillType(type); return this.#counts[type] > 0; }

  add(type: SkillType): void {
    assertSkillType(type);
    sumCounts(this.total, 1);
    this.#counts[type]++;
  }

  spend(type: SkillType): void {
    assertSkillType(type);
    if (!this.has(type)) throw new RangeError("Missing skill card");
    this.#counts[type]--;
  }
}
