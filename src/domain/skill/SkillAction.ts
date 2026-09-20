import { assertResourceType } from "../resource/ResourceType.ts";
import type { ResourceType, ResourceSnapshot } from "../resource/ResourceType.ts";
import { Player } from "../player/Player.ts";

export type SkillAttackTarget = ResourceType | "LIVESTOCK";
export type SkillActionType = "ATTACK" | "PEEK" | "REVEAL";
export interface SkillActionResult {
  readonly actionId: number;
  readonly playerId: string;
  readonly targetPlayerId: string;
  readonly skill: SkillActionType;
  readonly targetResource?: SkillAttackTarget;
  readonly outcome: "HIT" | "DEFENDED" | "VOID" | "PENDING_DEFENSE" | "PEEKED" | "REVEALED";
  readonly defenseSkillUsed?: true;
  readonly leaderScoreEligible: false;
}
export interface PrivatePeek {
  readonly actionId: number;
  readonly targetPlayerId: string;
  readonly hiddenResources: ResourceSnapshot;
}

export function assertSkillAttackTarget(target: unknown): asserts target is SkillAttackTarget {
  if (target !== "LIVESTOCK") assertResourceType(target);
}
export function targetCount(player: Player, target: SkillAttackTarget): number {
  return target === "LIVESTOCK" ? player.livestockCount : player.basicResources[target];
}
export function removeTarget(player: Player, target: SkillAttackTarget): void {
  player.spendTokens(target === "LIVESTOCK" ? { livestock: 1 } : { resources: { [target]: 1 } });
}
