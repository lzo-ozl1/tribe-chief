import { PointCard, TurnManager } from "../src/index.ts";

const turns = new TurnManager([
  { playerId: "p1", resources: { WOOD: 2, FOOD: 1 }, publicResources: { WOOD: 2, FOOD: 1 }, livestock: 1 },
  { playerId: "p2" },
], { deck: [new PointCard("beta-demo", 1, { WOOD: 3, FOOD: 2 })] });
turns.acquire("p1", {
  kind: "DISTINCT_THREE", resources: ["FIRE", "WATER", "STONE"], revealedResources: ["FIRE", "WATER"],
});
console.log("구매:", turns.purchase("p1", "beta-demo", { WOOD: 1, FOOD: 1 }));
console.log("점수:", turns.privatePlayerState("p1").score, "/ 가축:", turns.privatePlayerState("p1").livestockCount);
turns.endTurn("p1");
