import { TurnManager } from "../src/index.ts";

const turns = new TurnManager([
  { playerId: "p1", resources: { WOOD: 7, FOOD: 6 }, livestock: 2 },
  { playerId: "p2" },
]);
console.log("시작:", turns.publicState().currentTurn.playerId, "총 토큰:", turns.privatePlayerState("p1").totalTokens);
console.log("공개 정보:", turns.acquire("p1", {
  kind: "DISTINCT_THREE",
  resources: ["FIRE", "WATER", "STONE"],
  revealedResources: ["FIRE", "WATER"],
}));
console.log("획득 후:", turns.privatePlayerState("p1").totalTokens);
turns.endTurn("p1", { resources: { WOOD: 2 }, livestock: 1 });
console.log("종료 후:", turns.privatePlayerState("p1").totalTokens);
console.log("다음 플레이어:", turns.publicState().currentTurn.playerId);
turns.acquire("p2", { kind: "PAIR_AND_LIVESTOCK", resource: "FOOD" });
turns.endTurn("p2");
console.log("다음 라운드:", turns.publicState().round, "/ 현재 플레이어:", turns.publicState().currentTurn.playerId);
