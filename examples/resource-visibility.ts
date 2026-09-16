import { Player, Turn } from "../src/index.ts";

const player = new Player("p1");
for (const choice of [
  { kind: "DISTINCT_THREE", resources: ["WOOD", "FOOD", "STONE"], revealedResources: ["WOOD", "FOOD"] },
  { kind: "DISTINCT_THREE", resources: ["WATER", "FIRE", "WOOD"], revealedResources: ["WATER", "FIRE"] },
  { kind: "PAIR_AND_LIVESTOCK", resource: "FOOD" },
  { kind: "DISTINCT_THREE", resources: ["FOOD", "STONE", "WOOD"], revealedResources: ["STONE", "WOOD"] },
] as const) {
  const turn = new Turn(player);
  turn.acquire(player.playerId, choice);
  turn.end(player.playerId);
}
player.spendTokens({ resources: { FOOD: 1, STONE: 1 }, livestock: 1 });
console.log("공개 자원:", player.publicResources);
console.log("은닉 개수:", player.hiddenTokenCount, "총 토큰:", player.totalTokens);
console.log("소유자만 보는 은닉 자원:", player.hiddenResources);
