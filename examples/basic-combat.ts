import { TurnManager } from "../src/index.ts";

const turns = new TurnManager([
  { playerId: "attacker", resources: { FIRE: 2 }, publicResources: { FIRE: 1 } },
  { playerId: "defender", resources: { WOOD: 2, WATER: 2 } },
]);
console.log("공격 결과:", turns.attack("attacker", "defender", "WOOD"));
console.log("방어 후 공개 물:", turns.publicState().players[1]!.publicResources.WATER);
console.log("방어 후 은닉 물(소유자):", turns.privatePlayerState("defender").hiddenResources.WATER);
console.log("남은 불:", turns.privatePlayerState("attacker").basicResources.FIRE);
turns.acquire("attacker", { kind: "PAIR_AND_LIVESTOCK", resource: "FOOD" });
turns.endTurn("attacker");
console.log("다음 플레이어:", turns.publicState().currentTurn.playerId);
