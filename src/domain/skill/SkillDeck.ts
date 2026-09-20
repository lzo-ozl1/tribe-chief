import { SKILL_TYPES, assertSkillType } from "./SkillInventory.ts";
import type { SkillType } from "./SkillInventory.ts";

/** Server-side entropy. Never publish random values or draw order. */
export function randomUnit(): number {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]! / 0x100000000;
}

/** Temporary beta composition: five of each of four skills. */
export function createBetaSkillDeck(): readonly SkillType[] {
  const cards = SKILL_TYPES.flatMap(type => Array<SkillType>(5).fill(type));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(randomUnit() * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return Object.freeze(cards);
}

export class SkillDeck {
  readonly #cards: readonly SkillType[];
  #index = 0;
  constructor(cards: readonly SkillType[]) {
    if (!Array.isArray(cards)) throw new TypeError("Invalid skill deck");
    const copy = Array.from(cards);
    copy.forEach(assertSkillType);
    this.#cards = Object.freeze(copy);
  }
  get remaining(): number { return this.#cards.length - this.#index; }
  peek(): SkillType | null { return this.#cards[this.#index] ?? null; }
  draw(): SkillType | null {
    const card = this.peek();
    if (card !== null) this.#index++;
    return card;
  }
}
