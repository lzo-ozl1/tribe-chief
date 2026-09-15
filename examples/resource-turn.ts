import { Player } from "../src/index.ts";

const player = new Player("player-1", { resources: { WOOD: 7, FOOD: 6 }, livestock: 2 });
console.log("턴 시작:", player.totalTokens);
player.acquireTokens({ resources: { FIRE: 1, WATER: 1, STONE: 1 } });
console.log("자원 획득 후:", player.totalTokens, "/ 버릴 토큰:", player.excessTokens);
player.discardExcessTokens({ resources: { WOOD: 2 }, livestock: 1 });
player.assertCanEndTurn();
console.log("턴 종료:", player.totalTokens);
