import { TurnManager } from "../src/index.ts";

const game = new TurnManager([
  { playerId: "a", resources: { FIRE: 1 }, skills: { ATTACK: 1, PEEK: 1, REVEAL: 1 } },
  { playerId: "b", resources: { WOOD: 2, FOOD: 1 }, skills: { DEFENSE: 1 } },
], { skillDeck: [] });
game.attack("a", "b", "WOOD");
const pending = game.publicState().currentTurn.pendingDefense!;
console.log("방어 선택:", game.respondDefense("b", 1, pending.actionId, true));
console.log("시전자 전용 훔쳐보기:", game.peekHidden("a", "b"));
console.log("모두에게 공개:", game.revealHidden("a", "b", 0));
console.log("별도 스킬 공격:", game.attackSkill("a", "b", "FOOD"));
game.acquire("a", { kind: "DISTINCT_THREE", resources: ["FIRE", "WATER", "STONE"], revealedResources: ["FIRE", "WATER"] });
game.endTurn("a");
console.log("다음 플레이어:", game.publicState().currentTurn.playerId);
