import test from "node:test";
import assert from "node:assert/strict";
import { Player, Turn, TurnManager, BasicAttackResolver, VisibleResourceInventory } from "../src/index.ts";

const choice = () => ({ kind: "DISTINCT_THREE", resources: ["FIRE", "WATER", "STONE"], revealedResources: ["FIRE", "WATER"] });
const managerState = manager => ({ public: manager.publicState(), private: ["a", "b"].map(id => manager.privatePlayerState(id)) });
const playerState = player => ({ all: player.basicResources, public: player.publicResources, hidden: player.hiddenResources, total: player.totalTokens, score: player.score });
const build = (defender = { resources: { WOOD: 2 } }) => new TurnManager([
  { playerId: "a", resources: { FIRE: 2 }, publicResources: { FIRE: 1 } },
  { playerId: "b", ...defender },
]);

for (const [target, defense, wrongDefense] of [["WOOD", "WATER", "STONE"], ["FOOD", "STONE", "WATER"]]) {
  test(target + " hit removes a public target first and retains fire", () => {
    const manager = build({ resources: { [target]: 2, [wrongDefense]: 1 }, publicResources: { [target]: 1 } });
    const result = manager.attack("a", "b", target);
    assert.deepEqual(result, { attackerId: "a", defenderId: "b", targetResource: target, outcome: "HIT" });
    const victim = manager.privatePlayerState("b");
    assert.equal(victim.basicResources[target], 1);
    assert.equal(victim.publicResources[target], 0);
    assert.equal(victim.hiddenResources[target], 1);
    assert.equal(victim.basicResources[wrongDefense], 1);
    assert.equal(manager.privatePlayerState("a").basicResources.FIRE, 2);
    assert.equal(manager.publicState().currentTurn.attackAvailable, false);
  });

  test(target + " hit can remove a hidden target when no public target remains", () => {
    const manager = build({ resources: { [target]: 2 } });
    manager.attack("a", "b", target);
    assert.equal(manager.privatePlayerState("b").hiddenResources[target], 1);
    assert.equal(manager.privatePlayerState("b").publicResources[target], 0);
  });

  test(defense + " hidden automatic defense reveals exactly one without consuming it", () => {
    const manager = build({ resources: { [target]: 2, [defense]: 3 } });
    const result = manager.attack("a", "b", target);
    assert.equal(result.outcome, "DEFENDED");
    const defender = manager.privatePlayerState("b");
    assert.equal(defender.basicResources[target], 2);
    assert.equal(defender.basicResources[defense], 3);
    assert.equal(defender.publicResources[defense], 1);
    assert.equal(defender.hiddenResources[defense], 2);
    assert.equal(defender.totalTokens, 5);
    assert.equal(defender.hiddenTokenCount, 4);
    const attacker = manager.privatePlayerState("a");
    assert.equal(attacker.basicResources.FIRE, 1);
    assert.equal(attacker.publicResources.FIRE, 0);
    assert.equal(attacker.hiddenResources.FIRE, 1);
  });

  test(defense + " already-public defense does not expose additional hidden tokens", () => {
    const manager = build({ resources: { [target]: 1, [defense]: 3 }, publicResources: { [defense]: 1 } });
    manager.attack("a", "b", target);
    assert.equal(manager.privatePlayerState("b").publicResources[defense], 1);
    assert.equal(manager.privatePlayerState("b").hiddenResources[defense], 2);
  });

  test(target + " missing means void even with defense and the alternate target present", () => {
    const alternate = target === "WOOD" ? "FOOD" : "WOOD";
    const manager = build({ resources: { [alternate]: 2, [defense]: 2 } });
    const before = managerState(manager).private;
    assert.equal(manager.attack("a", "b", target).outcome, "VOID");
    assert.deepEqual(managerState(manager).private, before);
    assert.equal(manager.publicState().currentTurn.attackAvailable, false);
    assert.throws(() => manager.attack("a", "b", alternate), /already used/);
    manager.acquire("a", choice());
    manager.endTurn("a");
  });
}

test("empty defender consumes the attack opportunity without consuming fire", () => {
  const manager = build({});
  assert.equal(manager.attack("a", "b", "WOOD").outcome, "VOID");
  assert.equal(manager.privatePlayerState("a").basicResources.FIRE, 2);
  assert.throws(() => manager.attack("a", "b", "FOOD"), /already used/);
});

test("invalid actor, self, missing defender and unsupported targets change nothing", () => {
  const manager = build();
  const before = managerState(manager);
  const invalidActions = [
    () => manager.attack("b", "a", "WOOD"),
    () => manager.attack("unknown", "b", "WOOD"),
    () => manager.attack("a", "a", "WOOD"),
    () => manager.attack("a", "unknown", "WOOD"),
    ...["FIRE", "WATER", "STONE", "LIVESTOCK", "GOLD", null, undefined].map(target => () => manager.attack("a", "b", target)),
  ];
  for (const action of invalidActions) {
    assert.throws(action);
    assert.deepEqual(managerState(manager), before);
  }
  assert.equal(manager.attack("a", "b", "WOOD").outcome, "HIT");
});

test("no fire rejects the request before any defender information or opportunity changes", () => {
  const manager = new TurnManager([{ playerId: "a" }, { playerId: "b", resources: { WOOD: 1, WATER: 1 } }]);
  const before = managerState(manager);
  assert.throws(() => manager.attack("a", "b", "WOOD"), /requires FIRE/);
  assert.deepEqual(managerState(manager), before);
  manager.acquire("a", choice());
  assert.throws(() => manager.attack("a", "b", "WOOD"), /phase/);
  assert.equal(manager.privatePlayerState("a").basicResources.FIRE, 1);
});

test("only one attack per turn, including attacks against different opponents", () => {
  const manager = new TurnManager([
    { playerId: "a", resources: { FIRE: 2 } },
    { playerId: "b", resources: { WOOD: 2 } },
    { playerId: "c", resources: { WOOD: 2 } },
  ]);
  manager.attack("a", "b", "WOOD");
  const before = manager.privatePlayerState("c");
  assert.throws(() => manager.attack("a", "c", "WOOD"), /already used/);
  assert.deepEqual(manager.privatePlayerState("c"), before);
});

test("acquisition skips optional attack; ended turns reject further attacks", () => {
  const attacker = new Player("a", { resources: { FIRE: 2 } });
  const defender = new Player("b", { resources: { WOOD: 2 } });
  const turn = new Turn(attacker);
  turn.acquire("a", choice());
  assert.equal(turn.publicState().attackAvailable, false);
  assert.throws(() => turn.attack("a", defender, "WOOD"), /phase/);
  turn.end("a");
  assert.throws(() => turn.attack("a", defender, "WOOD"), /phase/);
  assert.equal(defender.basicResources.WOOD, 2);
});

test("failed acquisition leaves prior attack state intact, or allows an unspent opportunity", () => {
  const manager = build();
  assert.throws(() => manager.acquire("a", {}));
  assert.equal(manager.publicState().currentTurn.attackAvailable, true);
  manager.attack("a", "b", "WOOD");
  const before = managerState(manager);
  assert.throws(() => manager.acquire("a", {}));
  assert.deepEqual(managerState(manager), before);
  assert.throws(() => manager.attack("a", "b", "WOOD"), /already used/);
});

test("new turns reset availability and previous attack result is returned on end", () => {
  const manager = build({ resources: { WOOD: 3 } });
  const result = manager.attack("a", "b", "WOOD");
  manager.acquire("a", choice());
  const ended = manager.endTurn("a");
  assert.deepEqual(ended.attack, result);
  assert.equal(ended.attackAvailable, false);
  assert.equal(manager.publicState().currentTurn.attack, null);
  manager.acquire("b", choice());
  manager.endTurn("b");
  assert.equal(manager.publicState().round, 2);
  assert.equal(manager.publicState().currentTurn.attackAvailable, true);
  assert.equal(manager.attack("a", "b", "WOOD").outcome, "DEFENDED");
});

test("public attack result is immutable and omits hidden quantities", () => {
  const manager = build({ resources: { WOOD: 4, WATER: 3, FOOD: 2 } });
  const result = manager.attack("a", "b", "WOOD");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    attackerId: "a", defenderId: "b", targetResource: "WOOD", outcome: "DEFENDED",
  });
  assert.throws(() => { result.outcome = "HIT"; });
  assert.equal(manager.publicState().players[1].publicResources.WATER, 1);
  assert.equal("hiddenResources" in manager.publicState().players[1], false);
});

test("defense consumes hidden fire only when attacker has no public fire", () => {
  const attacker = new Player("a", { resources: { FIRE: 2 } });
  const defender = new Player("b", { resources: { WOOD: 1, WATER: 1 } });
  new BasicAttackResolver().resolve(attacker, defender, "WOOD");
  assert.equal(attacker.hiddenResources.FIRE, 1);
  assert.equal(defender.publicResources.WATER, 1);
});

test("reveal rejects absent or invalid hidden tokens atomically", () => {
  const stock = new VisibleResourceInventory({ WATER: 3, STONE: 1 }, { WATER: 1 });
  for (const request of [{ WATER: 3 }, { WATER: 1, STONE: 2 }, { WATER: -1 }, { GOLD: 1 }]) {
    const before = { public: stock.publicSnapshot(), hidden: stock.hiddenSnapshot() };
    assert.throws(() => stock.reveal(request));
    assert.deepEqual({ public: stock.publicSnapshot(), hidden: stock.hiddenSnapshot() }, before);
  }
  stock.reveal({ WATER: 1, STONE: 1 });
  assert.equal(stock.publicSnapshot().WATER, 2);
  assert.equal(stock.publicSnapshot().STONE, 1);
  assert.equal(stock.hiddenCount, 1);
  assert.equal(stock.total, 4);
});

test("ordinary combat does not assign leader scores before the leader system exists", () => {
  const attacker = new Player("a", { resources: { FIRE: 2 }, score: 2 });
  const defender = new Player("b", { resources: { WOOD: 1 }, score: 3 });
  new BasicAttackResolver().resolve(attacker, defender, "WOOD");
  assert.equal(attacker.score, 2);
  assert.equal(defender.score, 3);
  const before = playerState(attacker);
  assert.throws(() => new BasicAttackResolver().resolve(attacker, attacker, "WOOD"));
  assert.deepEqual(playerState(attacker), before);
});

for (const [outcome, defenderResources] of [["HIT", { WOOD: 1 }], ["VOID", { FOOD: 1 }]]) {
  test(outcome + " reveals exactly one surviving hidden fire token", () => {
    const manager = new TurnManager([
      { playerId: "a", resources: { FIRE: 3 } },
      { playerId: "b", resources: defenderResources },
    ]);
    const result = manager.attack("a", "b", "WOOD");
    assert.equal(result.outcome, outcome);
    const attacker = manager.privatePlayerState("a");
    assert.equal(attacker.publicResources.FIRE, 1);
    assert.equal(attacker.hiddenResources.FIRE, 2);
    assert.equal(attacker.totalTokens, 3);
    assert.equal(manager.publicState().currentTurn.attackAvailable, false);
    assert.deepEqual(manager.publicState().currentTurn.attack, result);
    assert.equal(manager.publicState().players[0].publicResources.FIRE, 1);
    assert.throws(() => manager.attack("a", "b", "FOOD"), /already used/);
  });

  test(outcome + " uses public fire without exposing additional hidden fire", () => {
    const manager = new TurnManager([
      { playerId: "a", resources: { FIRE: 3 }, publicResources: { FIRE: 1 } },
      { playerId: "b", resources: defenderResources },
    ]);
    assert.equal(manager.attack("a", "b", "WOOD").outcome, outcome);
    assert.equal(manager.privatePlayerState("a").publicResources.FIRE, 1);
    assert.equal(manager.privatePlayerState("a").hiddenResources.FIRE, 2);
  });
}

test("defended hidden fire is consumed without exposing an unused fire token", () => {
  const manager = new TurnManager([
    { playerId: "a", resources: { FIRE: 3 } },
    { playerId: "b", resources: { WOOD: 1, WATER: 1 } },
  ]);
  assert.equal(manager.attack("a", "b", "WOOD").outcome, "DEFENDED");
  assert.equal(manager.privatePlayerState("a").publicResources.FIRE, 0);
  assert.equal(manager.privatePlayerState("a").hiddenResources.FIRE, 2);
});
