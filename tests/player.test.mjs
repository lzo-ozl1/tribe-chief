import test from "node:test";
import assert from "node:assert/strict";
import { Player } from "../src/index.ts";

const fullPlayer = () => new Player("p1", { resources: { WOOD: 7, FOOD: 6 }, livestock: 2 });
const state = p => ({ resources: p.basicResources, livestock: p.livestockCount, score: p.score });

test("15 → 18 → 15: turn acquisition succeeds and selected excess is discarded", () => {
  const player = fullPlayer();
  assert.equal(player.totalTokens, 15);
  player.acquireTokens({ resources: { FIRE: 1, WATER: 1, STONE: 1 } });
  assert.equal(player.totalTokens, 18);
  assert.equal(player.excessTokens, 3);
  assert.equal(player.canEndTurn, false);
  assert.throws(() => player.assertCanEndTurn());
  player.discardExcessTokens({ resources: { WOOD: 2 }, livestock: 1 });
  assert.equal(player.totalTokens, 15);
  assert.equal(player.livestockCount, 1);
  assert.equal(player.basicResources.WOOD, 5);
  assert.doesNotThrow(() => player.assertCanEndTurn());
});

test("two identical resources plus livestock count as three tokens", () => {
  const player = fullPlayer();
  player.acquireTokens({ resources: { FIRE: 2 }, livestock: 1 });
  assert.equal(player.totalTokens, 18);
  assert.equal(player.livestockCount, 3);
});

test("spending during the turn reduces the required discard", () => {
  const player = fullPlayer();
  player.acquireTokens({ resources: { FIRE: 1, WATER: 1, STONE: 1 } });
  player.spendTokens({ resources: { WOOD: 2 } });
  assert.equal(player.excessTokens, 1);
  player.discardExcessTokens({ livestock: 1 });
  player.assertCanEndTurn();
});

test("no discard is required after spending to below the limit", () => {
  const player = fullPlayer();
  player.acquireTokens({ resources: { FIRE: 2 }, livestock: 1 });
  player.spendTokens({ resources: { WOOD: 4 } });
  assert.equal(player.totalTokens, 14);
  assert.equal(player.excessTokens, 0);
  player.assertCanEndTurn();
  player.discardExcessTokens({});
  assert.throws(() => player.discardExcessTokens({ livestock: 1 }));
});

test("invalid discard selections are atomic", () => {
  const player = fullPlayer();
  player.acquireTokens({ resources: { FIRE: 3 } });
  const before = state(player);
  for (const selection of [
    { resources: { WOOD: 2 } }, { resources: { WOOD: 4 } },
    { resources: { WATER: 3 } }, { livestock: 3 },
    { resources: { WOOD: 2 }, livestock: -1 },
  ]) {
    assert.throws(() => player.discardExcessTokens(selection));
    assert.deepEqual(state(player), before);
  }
});

test("invalid acquisitions and payments preserve resources and livestock together", () => {
  const player = fullPlayer();
  const before = state(player);
  for (const selection of [
    { resources: { WOOD: 1 }, livestock: -1 },
    { resources: { WOOD: -1 }, livestock: 1 },
  ]) {
    assert.throws(() => player.acquireTokens(selection));
    assert.deepEqual(state(player), before);
  }
  assert.throws(() => player.spendTokens({ resources: { WOOD: 1 }, livestock: 3 }));
  assert.throws(() => player.spendTokens({ resources: { FIRE: 1 }, livestock: 1 }));
  assert.deepEqual(state(player), before);
});

test("initial state supports restoring a mid-turn state above 15", () => {
  const player = new Player("p1", { resources: { FOOD: 16 }, livestock: 2 });
  assert.equal(player.excessTokens, 3);
  assert.throws(() => player.assertCanEndTurn());
});

test("player identity, score and counts are validated and encapsulated", () => {
  for (const id of ["", " ", null]) assert.throws(() => new Player(id));
  for (const value of [-1, 0.5, NaN, Infinity]) {
    assert.throws(() => new Player("p", { livestock: value }));
    assert.throws(() => new Player("p", { score: value }));
  }
  const initial = { resources: { WOOD: 1 }, livestock: 2, score: 3 };
  const player = new Player("p", initial);
  initial.resources.WOOD = 90;
  assert.equal(player.totalTokens, 3);
  assert.throws(() => { player.basicResources.WOOD = 90; });
  assert.throws(() => { player.livestockCount = 90; });
  player.addScore(2);
  assert.equal(player.score, 5);
  assert.throws(() => player.addScore(-1));
  assert.equal(player.score, 5);
});

test("combined token and score overflow are rejected atomically", () => {
  const player = new Player("p", { resources: { FOOD: Number.MAX_SAFE_INTEGER }, score: Number.MAX_SAFE_INTEGER });
  const before = state(player);
  assert.throws(() => player.acquireTokens({ livestock: 1 }));
  assert.throws(() => player.addScore(1));
  assert.deepEqual(state(player), before);
  assert.throws(() => new Player("p", { resources: { FOOD: Number.MAX_SAFE_INTEGER }, livestock: 1 }));
});
