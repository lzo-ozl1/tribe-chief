import { Player } from "../player/Player.ts";

export type BasicAttackTarget = "WOOD" | "FOOD";
export type BasicAttackOutcome = "HIT" | "DEFENDED" | "VOID" | "PENDING_DEFENSE";

export interface BasicAttackResult {
  readonly attackerId: string;
  readonly defenderId: string;
  readonly targetResource: BasicAttackTarget;
  readonly outcome: BasicAttackOutcome;
  readonly defenseSkillUsed?: true;
  readonly leaderScoreEligible?: false;
}

/** Resolves one normal fire attack. Turn timing and frequency belong to Turn. */
export class BasicAttackResolver {
  resolve(attacker: Player, defender: Player, target: BasicAttackTarget, useDefenseSkill = false): BasicAttackResult {
    if (target !== "WOOD" && target !== "FOOD") {
      throw new TypeError("A basic attack can target only WOOD or FOOD");
    }
    if (attacker.playerId === defender.playerId) throw new Error("Cannot attack yourself");
    if (attacker.basicResources.FIRE < 1) throw new Error("A basic attack requires FIRE");

    const holdings = defender.basicResources;
    let outcome: BasicAttackOutcome;
    if (holdings[target] === 0) {
      // No fallback target, no fire loss; a valid void attempt still uses the turn's attack.
      outcome = "VOID";
    } else {
      const defense = target === "WOOD" ? "WATER" : "STONE";
      if (holdings[defense] > 0) {
        // All costs are known to exist before either player is changed.
        // Use an already-public defense token; otherwise reveal exactly one hidden token.
        if (defender.publicResources[defense] === 0) {
          defender.revealResources({ [defense]: 1 });
        }
        attacker.spendTokens({ resources: { FIRE: 1 } });
        outcome = "DEFENDED";
      } else if (useDefenseSkill) {
        if (!defender.hasSkill("DEFENSE")) throw new Error("Missing defense skill");
        defender.spendSkill("DEFENSE");
        attacker.spendTokens({ resources: { FIRE: 1 } });
        return Object.freeze({ attackerId: attacker.playerId, defenderId: defender.playerId,
          targetResource: target, outcome: "DEFENDED", defenseSkillUsed: true, leaderScoreEligible: false });
      } else {
        defender.spendTokens({ resources: { [target]: 1 } });
        outcome = "HIT";
      }
    }
    // The attack is public. Surviving hidden fire becomes public; consumed fire is gone.
    if (outcome !== "DEFENDED" && attacker.publicResources.FIRE === 0) {
      attacker.revealResources({ FIRE: 1 });
    }
    return Object.freeze({
      attackerId: attacker.playerId,
      defenderId: defender.playerId,
      targetResource: target,
      outcome,
    });
  }
}
