import test from "node:test";
import assert from "node:assert/strict";
import { ResourceInventory } from "../src/index.ts";

test("resources can be added, queried and spent", () => {
  const inventory = new ResourceInventory({ FIRE: 2 });
  inventory.add({ WOOD: 3, FOOD: 1 });
  assert.equal(inventory.total, 6);
  assert.equal(inventory.get("WATER"), 0);
  assert.equal(inventory.has({ FIRE: 2, WOOD: 3 }), true);
  inventory.spend({ FIRE: 1, WOOD: 2 });
  assert.equal(inventory.total, 3);
  assert.equal(inventory.has({ WOOD: 2 }), false);
});

test("failed multi-resource payment leaves every resource unchanged", () => {
  const inventory = new ResourceInventory({ FIRE: 2, WOOD: 1 });
  const before = inventory.snapshot();
  assert.throws(() => inventory.spend({ FIRE: 1, WOOD: 2 }), /Insufficient/);
  assert.deepEqual(inventory.snapshot(), before);
});

test("input objects and snapshots cannot mutate inventory", () => {
  const input = { FIRE: 2 };
  const inventory = new ResourceInventory(input);
  input.FIRE = 99;
  assert.throws(() => { inventory.snapshot().FIRE = 99; }, TypeError);
  assert.equal(inventory.get("FIRE"), 2);
});

for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1", undefined]) {
  test("invalid resource count is rejected: " + String(value), () => {
    const inventory = new ResourceInventory({ WOOD: 2 });
    assert.throws(() => new ResourceInventory({ FIRE: value }));
    assert.throws(() => inventory.add({ FIRE: 1, FOOD: value }));
    assert.throws(() => inventory.spend({ WOOD: 1, FOOD: value }));
    assert.throws(() => inventory.has({ FOOD: value }));
    assert.equal(inventory.total, 2);
  });
}

test("unknown resources and invalid containers are rejected", () => {
  for (const input of [{ GOLD: 1 }, { toString: 1 }, null, [], 1]) {
    assert.throws(() => new ResourceInventory(input));
  }
  assert.throws(() => new ResourceInventory().get("GOLD"));
});

test("safe integer overflow cannot corrupt inventory", () => {
  const inventory = new ResourceInventory({ FIRE: Number.MAX_SAFE_INTEGER });
  assert.throws(() => inventory.add({ WOOD: 1 }));
  assert.equal(inventory.total, Number.MAX_SAFE_INTEGER);
  assert.throws(() => new ResourceInventory({ FIRE: Number.MAX_SAFE_INTEGER, FOOD: 1 }));
});
