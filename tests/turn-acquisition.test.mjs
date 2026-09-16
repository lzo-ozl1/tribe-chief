import test from "node:test";
import assert from "node:assert/strict";
import { Player, ResourceAcquisition, Turn, TurnManager, RESOURCE_TYPES } from "../src/index.ts";

const distinct = () => ({ kind: "DISTINCT_THREE", resources: ["FIRE", "WATER", "STONE"], revealedResources: ["FIRE", "WATER"] });
const pair = resource => ({ kind: "PAIR_AND_LIVESTOCK", resource });
const setup = () => [{ playerId: "p1", resources: { WOOD: 7, FOOD: 6 }, livestock: 2 }, { playerId: "p2" }];
const state = manager => ({ public: manager.publicState(), private: ["p1", "p2"].map(id => manager.privatePlayerState(id)) });

test("every distinct resource triple and each two-type reveal grants exactly three tokens", () => {
  for (let i = 0; i < RESOURCE_TYPES.length; i++) {
    for (let j = i + 1; j < RESOURCE_TYPES.length; j++) {
      for (let k = j + 1; k < RESOURCE_TYPES.length; k++) {
        const resources = [RESOURCE_TYPES[i], RESOURCE_TYPES[j], RESOURCE_TYPES[k]];
        for (const hiddenResource of resources) {
          const revealedResources = resources.filter(type => type !== hiddenResource);
          const acquisition = new ResourceAcquisition({ kind: "DISTINCT_THREE", resources, revealedResources });
          assert.deepEqual(acquisition.tokens, { resources: Object.fromEntries(resources.map(r => [r, 1])), livestock: 0 });
          assert.deepEqual(acquisition.disclosure, { resourceTypes: revealedResources, livestockGained: 0 });
        }
      }
    }
  }
});

test("all five pair choices grant two basic tokens and one livestock", () => {
  for (const resource of RESOURCE_TYPES) {
    const acquisition = new ResourceAcquisition(pair(resource));
    assert.deepEqual(acquisition.tokens, { resources: { [resource]: 2 }, livestock: 1 });
    assert.deepEqual(acquisition.disclosure, { resourceTypes: [resource], livestockGained: 1 });
  }
});

test("invalid acquisitions preserve player, phase and public information and allow retry", () => {
  const manager = new TurnManager(setup());
  const before = state(manager);
  const invalid = [
    null, undefined, {}, { kind: "FREE" }, pair("GOLD"),
    { ...distinct(), resources: ["FIRE", "FIRE", "STONE"] },
    { ...distinct(), resources: ["FIRE", "WATER"] },
    { ...distinct(), resources: ["FIRE", "WATER", "STONE", "FOOD"] },
    { ...distinct(), resources: ["FIRE", "WATER", "GOLD"] },
    { ...distinct(), resources: new Array(3) },
    { ...distinct(), revealedResources: ["FIRE", "FOOD"] },
    { ...distinct(), revealedResources: undefined },
    { ...distinct(), revealedResources: null },
    { ...distinct(), revealedResources: "FIRE" },
    { ...distinct(), revealedResources: [] },
    { ...distinct(), revealedResources: ["FIRE"] },
    { ...distinct(), revealedResources: ["FIRE", "WATER", "STONE"] },
    { ...distinct(), revealedResources: ["FIRE", "FIRE"] },
    { ...distinct(), revealedResources: ["FIRE", "GOLD"] },
    { ...distinct(), revealedResources: new Array(2) },
    { kind: "DISTINCT_THREE", resources: distinct().resources, revealedResource: "FIRE" },
  ];
  for (const choice of invalid) {
    assert.throws(() => manager.acquire("p1", choice));
    assert.deepEqual(state(manager), before);
  }
  manager.acquire("p1", distinct());
  assert.equal(manager.privatePlayerState("p1").totalTokens, 18);
});

test("15 → 18 → selected discard → next player is atomic and leaves 15", () => {
  const manager = new TurnManager(setup());
  manager.acquire("p1", distinct());
  assert.equal(manager.privatePlayerState("p1").totalTokens, 18);
  const before = state(manager);
  for (const discard of [undefined, { resources: { WOOD: 2 } }, { resources: { WOOD: 4 } }, { livestock: 3 }]) {
    assert.throws(() => manager.endTurn("p1", discard));
    assert.deepEqual(state(manager), before);
  }
  const ended = manager.endTurn("p1", { resources: { WOOD: 2 }, livestock: 1 });
  assert.equal(ended.phase, "ENDED");
  assert.equal(manager.privatePlayerState("p1").totalTokens, 15);
  assert.equal(manager.publicState().currentTurn.playerId, "p2");
  assert.equal(manager.publicState().currentTurn.phase, "AWAITING_ACQUISITION");
  assert.equal(manager.publicState().currentTurn.acquisition, null);
});

test("wrong actor, acquisition skip and duplicate acquisition do not advance turns", () => {
  const manager = new TurnManager(setup());
  const before = state(manager);
  assert.throws(() => manager.acquire("p2", distinct()), /active player/);
  assert.throws(() => manager.acquire("unknown", distinct()), /active player/);
  assert.throws(() => manager.endTurn("p1"), /phase/);
  assert.deepEqual(state(manager), before);
  manager.acquire("p1", distinct());
  const acquired = state(manager);
  assert.throws(() => manager.acquire("p1", pair("FOOD")), /phase/);
  assert.throws(() => manager.endTurn("p2", { resources: { WOOD: 3 } }), /active player/);
  assert.deepEqual(state(manager), acquired);
});

test("two to six players rotate in supplied order and round increments only at wraparound", () => {
  for (let count = 2; count <= 6; count++) {
    const manager = new TurnManager(Array.from({ length: count }, (_, i) => ({ playerId: "p" + i })));
    for (let turn = 0; turn < count * 2; turn++) {
      const current = manager.publicState();
      const playerId = "p" + (turn % count);
      assert.equal(current.currentTurn.playerId, playerId);
      assert.equal(current.turnNumber, turn + 1);
      assert.equal(current.round, Math.floor(turn / count) + 1);
      manager.acquire(playerId, pair("WOOD"));
      manager.endTurn(playerId);
    }
    assert.equal(manager.publicState().round, 3);
    assert.equal(manager.publicState().currentTurn.playerId, "p0");
  }
});

test("public JSON exposes the two revealed types and hides the third", () => {
  const manager = new TurnManager(setup());
  const disclosure = manager.acquire("p1", distinct());
  assert.deepEqual(disclosure, { resourceTypes: ["FIRE", "WATER"], livestockGained: 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(manager.publicState())), {
    turnNumber: 1, round: 1,
    currentTurn: { playerId: "p1", phase: "AFTER_ACQUISITION", acquisition: disclosure },
    players: [
      { playerId: "p1", score: 0, livestockCount: 2, publicResources: { FIRE: 1, WATER: 1, STONE: 0, WOOD: 0, FOOD: 0 }, hiddenTokenCount: 14, totalTokens: 18 },
      { playerId: "p2", score: 0, livestockCount: 0, publicResources: { FIRE: 0, WATER: 0, STONE: 0, WOOD: 0, FOOD: 0 }, hiddenTokenCount: 0, totalTokens: 0 },
    ],
  });
  assert.equal(manager.publicState().players[0].publicResources.STONE, 0);
  assert.equal(JSON.stringify(manager.publicState()).includes("hiddenResources"), false);
  assert.equal(manager.privatePlayerState("p1").basicResources.STONE, 1);
  assert.throws(() => manager.privatePlayerState("unknown"));
});

test("pair disclosure and public livestock count are updated together", () => {
  const manager = new TurnManager([{ playerId: "p1" }, { playerId: "p2" }]);
  manager.acquire("p1", pair("FOOD"));
  assert.deepEqual(manager.publicState().currentTurn.acquisition, { resourceTypes: ["FOOD"], livestockGained: 1 });
  assert.equal(manager.publicState().players[0].livestockCount, 1);
  assert.equal(manager.privatePlayerState("p1").basicResources.FOOD, 2);
  manager.endTurn("p1");
});

test("mutating setup, choices and returned snapshots cannot change engine state", () => {
  const initial = setup();
  const manager = new TurnManager(initial);
  initial[0].resources.WOOD = 100;
  initial.reverse();
  const choice = distinct();
  const disclosure = manager.acquire("p1", choice);
  choice.resources[0] = "FOOD";
  choice.revealedResources[0] = "FOOD";
  const before = state(manager);
  assert.throws(() => { disclosure.resourceTypes[0] = "FOOD"; });
  assert.throws(() => { manager.publicState().currentTurn.phase = "ENDED"; });
  assert.throws(() => { manager.publicState().players[0].livestockCount = 99; });
  assert.throws(() => { manager.privatePlayerState("p1").basicResources.WOOD = 99; });
  assert.deepEqual(state(manager), before);
  const acquisition = new ResourceAcquisition(distinct());
  assert.throws(() => { acquisition.tokens.resources.FIRE = 99; });
});

test("invalid player counts and identities are rejected", () => {
  for (const entries of [null, [], [{ playerId: "p" }], Array.from({ length: 7 }, (_, i) => ({ playerId: String(i) })),
    [{ playerId: "p" }, { playerId: "p" }], [{ playerId: "" }, { playerId: "p" }]]) {
    assert.throws(() => new TurnManager(entries));
  }
});

test("failed inventory acquisition does not consume a turn's acquisition", () => {
  const player = new Player("p", { resources: { WOOD: Number.MAX_SAFE_INTEGER } });
  const turn = new Turn(player);
  assert.throws(() => turn.acquire("p", distinct()));
  assert.equal(turn.publicState().phase, "AWAITING_ACQUISITION");
  assert.equal(turn.publicState().acquisition, null);
  player.spendTokens({ resources: { WOOD: Number.MAX_SAFE_INTEGER } });
  turn.acquire("p", distinct());
  turn.end("p");
});

test("end uses current holdings after a future domain action spends tokens", () => {
  const player = new Player("p", { resources: { WOOD: 15 } });
  const turn = new Turn(player);
  turn.acquire("p", distinct());
  player.spendTokens({ resources: { WOOD: 2 } });
  assert.equal(player.excessTokens, 1);
  turn.end("p", { resources: { WOOD: 1 } });
  assert.equal(player.totalTokens, 15);
  assert.equal(turn.publicState().phase, "ENDED");
  assert.throws(() => turn.end("p"), /phase/);
  assert.throws(() => turn.acquire("p", distinct()), /phase/);
});

test("below-limit players can end without discarding and cannot discard unnecessarily", () => {
  const manager = new TurnManager([{ playerId: "p1" }, { playerId: "p2" }]);
  manager.acquire("p1", distinct());
  assert.throws(() => manager.endTurn("p1", { resources: { FIRE: 1 } }));
  assert.equal(manager.privatePlayerState("p1").totalTokens, 3);
  manager.endTurn("p1");
  assert.equal(manager.publicState().currentTurn.playerId, "p2");
});
