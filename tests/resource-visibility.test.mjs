import test from "node:test";
import assert from "node:assert/strict";
import { Player, Turn, TurnManager, VisibleResourceInventory } from "../src/index.ts";

const counts = values => ({ FIRE: 0, WATER: 0, STONE: 0, WOOD: 0, FOOD: 0, ...values });
const snapshot = p => ({ all: p.basicResources, visible: p.publicResources, hidden: p.hiddenResources, livestock: p.livestockCount });
const acquire = (p, resources, revealedResources) => {
  const turn = new Turn(p);
  turn.acquire(p.playerId, { kind: "DISTINCT_THREE", resources, revealedResources });
  turn.end(p.playerId);
};

test("four acquisitions preserve visibility and payment removes public stock first", () => {
  const p = new Player("p");
  acquire(p, ["WOOD", "FOOD", "STONE"], ["WOOD", "FOOD"]);
  acquire(p, ["WATER", "FIRE", "WOOD"], ["WATER", "FIRE"]);
  const third = new Turn(p);
  third.acquire("p", { kind: "PAIR_AND_LIVESTOCK", resource: "FOOD" });
  third.end("p");
  acquire(p, ["FOOD", "STONE", "WOOD"], ["STONE", "WOOD"]);
  assert.deepEqual(p.publicResources, counts({ WOOD: 2, FOOD: 3, WATER: 1, FIRE: 1, STONE: 1 }));
  assert.deepEqual(p.hiddenResources, counts({ STONE: 1, WOOD: 1, FOOD: 1 }));
  assert.equal(p.totalTokens, 12);
  p.spendTokens({ resources: { FOOD: 1, STONE: 1 }, livestock: 1 });
  assert.deepEqual(p.publicResources, counts({ WOOD: 2, FOOD: 2, WATER: 1, FIRE: 1 }));
  assert.deepEqual(p.hiddenResources, counts({ STONE: 1, WOOD: 1, FOOD: 1 }));
  assert.equal(p.totalTokens, 9);
});

test("same-type public-first removal spills into hidden only when needed", () => {
  const p = new Player("p", { resources: { WOOD: 4, FOOD: 2 }, publicResources: { WOOD: 2, FOOD: 2 } });
  p.spendTokens({ resources: { WOOD: 3 } });
  assert.deepEqual(p.publicResources, counts({ FOOD: 2 }));
  assert.deepEqual(p.hiddenResources, counts({ WOOD: 1 }));
  assert.equal(p.totalTokens, 3);
});

test("discarding excess uses the same public-first policy", () => {
  const p = new Player("p", { resources: { WOOD: 16 }, publicResources: { WOOD: 2 }, livestock: 2 });
  p.discardExcessTokens({ resources: { WOOD: 3 } });
  assert.equal(p.publicResources.WOOD, 0);
  assert.equal(p.hiddenResources.WOOD, 13);
  assert.equal(p.totalTokens, 15);
});

test("invalid acquisitions, payments and discards preserve all visibility buckets", () => {
  const p = new Player("p", { resources: { WOOD: 15 }, publicResources: { WOOD: 2 }, livestock: 2 });
  const before = snapshot(p);
  for (const action of [
    () => p.acquireTokens({ resources: { FOOD: 1 }, livestock: 1 }, { FOOD: 2 }),
    () => p.acquireTokens({ resources: { FOOD: 1 } }, { STONE: 1 }),
    () => p.acquireTokens({ resources: { FOOD: 1 } }, { FOOD: -1 }),
    () => p.spendTokens({ resources: { WOOD: 1, FOOD: 1 }, livestock: 1 }),
    () => p.spendTokens({ resources: { WOOD: 1 }, livestock: 3 }),
    () => p.discardExcessTokens({ resources: { FOOD: 2 } }),
  ]) {
    assert.throws(action);
    assert.deepEqual(snapshot(p), before);
  }
});

test("public views are identical for different hidden compositions with equal counts", () => {
  const create = hidden => new TurnManager([
    { playerId: "p1", resources: { WOOD: 2, ...hidden }, publicResources: { WOOD: 2 }, livestock: 1 },
    { playerId: "p2" },
  ]);
  const a = create({ STONE: 3 });
  const b = create({ WATER: 3 });
  assert.deepEqual(a.publicState(), b.publicState());
  assert.notDeepEqual(a.privatePlayerState("p1").hiddenResources, b.privatePlayerState("p1").hiddenResources);
  assert.deepEqual(a.publicState().players[0], {
    playerId: "p1", score: 0, purchasedCards: [], pendingSkillRewards: 0, publicResources: counts({ WOOD: 2 }),
    hiddenTokenCount: 3, livestockCount: 1, totalTokens: 6,
  });
  assert.equal(JSON.stringify(a.publicState()).includes("hiddenResources"), false);
});

test("public stock persists between turns and snapshots cannot mutate visibility", () => {
  const setup = [{ playerId: "p1", resources: { WOOD: 1 }, publicResources: { WOOD: 1 } }, { playerId: "p2" }];
  const manager = new TurnManager(setup);
  setup[0].publicResources.WOOD = 99;
  manager.acquire("p1", { kind: "PAIR_AND_LIVESTOCK", resource: "FOOD" });
  manager.endTurn("p1");
  const visible = manager.publicState().players[0];
  assert.equal(visible.publicResources.WOOD, 1);
  assert.equal(visible.publicResources.FOOD, 2);
  assert.equal(visible.hiddenTokenCount, 0);
  assert.equal(visible.livestockCount, 1);
  assert.throws(() => { visible.publicResources.FOOD = 99; });
  assert.throws(() => { manager.privatePlayerState("p1").hiddenResources.STONE = 99; });
});

test("twelve legal acquisition cycles can retain twelve hidden tokens without a special cap", () => {
  const manager = new TurnManager([{ playerId: "p1" }, { playerId: "p2" }]);
  for (let round = 1; round <= 12; round++) {
    for (const id of ["p1", "p2"]) {
      manager.acquire(id, { kind: "DISTINCT_THREE", resources: ["WOOD", "FOOD", "STONE"], revealedResources: ["WOOD", "FOOD"] });
      const state = manager.privatePlayerState(id);
      const wood = Math.min(state.excessTokens, state.publicResources.WOOD);
      manager.endTurn(id, { resources: { WOOD: wood, FOOD: state.excessTokens - wood } });
      assert.equal(manager.privatePlayerState(id).hiddenTokenCount, round);
      assert.ok(manager.privatePlayerState(id).totalTokens <= 15);
    }
  }
  assert.equal(manager.publicState().players[0].hiddenTokenCount, 12);
});

test("the only capacity limit remains fifteen at turn end even with all-hidden stock", () => {
  const p = new Player("p", { resources: { STONE: 18 } });
  assert.equal(p.hiddenTokenCount, 18);
  assert.throws(() => p.assertCanEndTurn());
  p.discardExcessTokens({ resources: { STONE: 3 } });
  p.assertCanEndTurn();
  assert.equal(p.hiddenTokenCount, 15);
});

test("visibility subset validation and combined overflow are atomic", () => {
  assert.throws(() => new VisibleResourceInventory({ WOOD: 1 }, { WOOD: 2 }));
  assert.throws(() => new VisibleResourceInventory({ WOOD: 1 }, { GOLD: 1 }));
  const stock = new VisibleResourceInventory({ WOOD: Number.MAX_SAFE_INTEGER }, { WOOD: 1 });
  assert.throws(() => stock.add({ FOOD: 1 }, { FOOD: 1 }));
  assert.equal(stock.total, Number.MAX_SAFE_INTEGER);
  assert.equal(stock.publicSnapshot().WOOD, 1);
  assert.equal(stock.hiddenSnapshot().WOOD, Number.MAX_SAFE_INTEGER - 1);
});
