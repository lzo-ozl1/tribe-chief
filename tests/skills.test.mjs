import test from "node:test";
import assert from "node:assert/strict";
import { SkillInventory } from "../src/domain/skill/SkillInventory.ts";

test("skill inventory copies input, freezes snapshots and spends exactly one", () => {
  const input = { ATTACK: 2, DEFENSE: 1 };
  const hand = new SkillInventory(input);
  input.ATTACK = 99;
  assert.equal(hand.total, 3);
  hand.spend("ATTACK");
  hand.spend("DEFENSE");
  assert.deepEqual(hand.snapshot(), { ATTACK: 1, DEFENSE: 0, PEEK: 0, REVEAL: 0 });
  assert.throws(() => { hand.snapshot().ATTACK = 9; });
  assert.throws(() => hand.spend("DEFENSE"));
  assert.equal(hand.total, 1);
});

test("invalid skill types and counts cannot change a hand", () => {
  for (const input of [null, [], { GOLD: 1 }, { ATTACK: -1 }, { DEFENSE: 0.5 },
    { ATTACK: undefined }, { ATTACK: Infinity }, { ATTACK: Number.MAX_SAFE_INTEGER, DEFENSE: 1 }]) {
    assert.throws(() => new SkillInventory(input));
  }
  const hand = new SkillInventory({ ATTACK: 1 });
  for (const action of [() => hand.add("OTHER"), () => hand.spend("OTHER"), () => hand.has("OTHER")]) {
    assert.throws(action);
    assert.deepEqual(hand.snapshot(), { ATTACK: 1, DEFENSE: 0, PEEK: 0, REVEAL: 0 });
  }
  const full = new SkillInventory({ ATTACK: Number.MAX_SAFE_INTEGER });
  assert.throws(() => full.add("DEFENSE"));
  assert.equal(full.total, Number.MAX_SAFE_INTEGER);
});

import { TurnManager, PointCard, SkillDeck, createBetaSkillDeck, RESOURCE_TYPES, Player, Turn } from "../src/index.ts";
const choice = () => ({ kind: "DISTINCT_THREE", resources: ["FIRE","WATER","STONE"], revealedResources: ["FIRE","WATER"] });
const make = (a = {}, b = {}) => new TurnManager([{ playerId: "a", ...a }, { playerId: "b", ...b }], {skillDeck: []});
const state = m => ({public: m.publicState(), private: ["a","b"].map(id => m.privatePlayerState(id))});
const respond = (m, use, who = "b") => m.respondDefense(who, m.publicState().turnNumber, m.publicState().currentTurn.pendingDefense.actionId, use);

test("beta skill deck contains five of each type and validates copied custom decks", () => {
  const deck = createBetaSkillDeck();
  assert.equal(deck.length,20);
  for (const type of ["ATTACK","DEFENSE","PEEK","REVEAL"]) assert.equal(deck.filter(x=>x===type).length,5);
  const cards = ["ATTACK","PEEK"]; const d = new SkillDeck(cards); cards[0]="DEFENSE";
  assert.equal(d.draw(),"ATTACK"); assert.equal(d.draw(),"PEEK"); assert.equal(d.draw(),null);
  assert.equal(d.remaining,0);
  assert.throws(()=>new SkillDeck(["OTHER"]));
});

test("tier-three purchase draws one private reward, without including type in purchase result", () => {
  const card = new PointCard("three",3,{WOOD:4,FOOD:3,STONE:3});
  const m = new TurnManager([{playerId:"a",resources:{WOOD:4,FOOD:3,STONE:3}},{playerId:"b"}],{deck:[card],skillDeck:["PEEK"]});
  m.acquire("a",choice());
  const result = m.purchase("a","three");
  assert.equal(m.privatePlayerState("a").skills.PEEK,1);
  assert.equal(m.privatePlayerState("a").pendingSkillRewards,0);
  assert.equal(m.publicState().players[0].skillCardCount,1);
  assert.equal(m.publicState().skillDeckRemaining,0);
  assert.equal("skills" in m.publicState().players[0],false);
  assert.equal(JSON.stringify(result).includes("PEEK"),false);
  assert.throws(()=>m.purchase("a","three"));
  assert.equal(m.privatePlayerState("a").skillCardCount,1);
});

test("exhausted skill deck preserves reward entitlement and purchase succeeds", () => {
  const m = new TurnManager([{playerId:"a",resources:{WOOD:4,FOOD:3,STONE:3}},{playerId:"b"}],
    {deck:[new PointCard("three",3,{WOOD:4,FOOD:3,STONE:3})],skillDeck:[]});
  m.acquire("a",choice());m.purchase("a","three");
  assert.equal(m.privatePlayerState("a").pendingSkillRewards,1);
  assert.equal(m.privatePlayerState("a").score,3);
});

for (const target of [...RESOURCE_TYPES,"LIVESTOCK"]) {
  test("skill attack hits "+target+" without fire and ignores passive defenses", () => {
    const m=make({skills:{ATTACK:1}}, {resources:{FIRE:2,WATER:2,STONE:2,WOOD:2,FOOD:2},
      publicResources:{FIRE:1,WATER:1,STONE:1,WOOD:1,FOOD:1},livestock:2});
    const r=m.attackSkill("a","b",target);
    assert.equal(r.outcome,"HIT");assert.equal(r.leaderScoreEligible,false);
    const b=m.privatePlayerState("b");
    assert.equal(target==="LIVESTOCK"?b.livestockCount:b.basicResources[target],1);
    if(target!=="LIVESTOCK") {assert.equal(b.publicResources[target],0);assert.equal(b.hiddenResources[target],1);}
    assert.equal(m.privatePlayerState("a").skillCardCount,0);
    assert.equal(m.privatePlayerState("a").score,0);assert.equal(b.score,0);
  });
}

test("ordinary attack plus multiple skills before and after acquisition are independent", () => {
  const m=make({resources:{FIRE:1},skills:{ATTACK:3}}, {resources:{WOOD:5}});
  m.attack("a","b","WOOD");
  m.attackSkill("a","b","WOOD");
  m.acquire("a",choice());
  m.attackSkill("a","b","WOOD");m.attackSkill("a","b","WOOD");
  assert.equal(m.privatePlayerState("b").basicResources.WOOD,1);
  assert.equal(m.privatePlayerState("a").basicResources.FIRE,2);
  assert.throws(()=>m.attackSkill("a","b","WOOD"));
});

test("starting with a skill skips the opening basic attack; void skill consumes one card", () => {
  const m=make({resources:{FIRE:1},skills:{ATTACK:2}}, {resources:{WATER:1},skills:{DEFENSE:1}});
  assert.equal(m.attackSkill("a","b","WOOD").outcome,"VOID");
  assert.equal(m.privatePlayerState("b").skills.DEFENSE,1);
  assert.equal(m.privatePlayerState("a").skills.ATTACK,1);
  assert.equal(m.publicState().currentTurn.pendingDefense,null);
  assert.throws(()=>m.attack("a","b","WOOD"));
});

test("missing target is void before passive or skill defense", () => {
  const m=make({resources:{FIRE:1}}, {resources:{WATER:1},skills:{DEFENSE:1}});
  assert.equal(m.attack("a","b","WOOD").outcome,"VOID");
  assert.equal(m.privatePlayerState("b").publicResources.WATER,0);
  assert.equal(m.privatePlayerState("b").skills.DEFENSE,1);
  assert.equal(m.publicState().currentTurn.pendingDefense,null);
});

test("passive defense takes priority and never consumes a defense skill", () => {
  const m=make({resources:{FIRE:1}}, {resources:{WOOD:1,WATER:1},skills:{DEFENSE:1}});
  assert.equal(m.attack("a","b","WOOD").outcome,"DEFENDED");
  assert.equal(m.privatePlayerState("b").skills.DEFENSE,1);
  assert.equal(m.publicState().currentTurn.pendingDefense,null);
});

for (const kind of ["basic","skill"]) for (const use of [false,true]) {
  test(kind+" defense is optional: "+use, () => {
    const m=make({resources:{FIRE:1},skills:{ATTACK:1}}, {resources:{WOOD:1},skills:{DEFENSE:1}});
    const initialFire=m.privatePlayerState("a").basicResources.FIRE;
    const r=kind==="basic"?m.attack("a","b","WOOD"):m.attackSkill("a","b","WOOD");
    assert.equal(r.outcome,"PENDING_DEFENSE");
    assert.equal(m.privatePlayerState("b").basicResources.WOOD,1);
    assert.equal(m.privatePlayerState("b").skills.DEFENSE,1);
    assert.equal(m.defenseOptions("b").canUseDefenseSkill,true);
    const done=respond(m,use);
    assert.equal(done.outcome,use?"DEFENDED":"HIT");
    assert.equal(m.privatePlayerState("b").skills.DEFENSE,use?0:1);
    assert.equal(m.privatePlayerState("b").basicResources.WOOD,use?1:0);
    assert.equal(m.privatePlayerState("a").basicResources.FIRE,kind==="basic"&&use?initialFire-1:initialFire);
    assert.equal(m.publicState().currentTurn.pendingDefense,null);
    assert.equal(m.privatePlayerState("a").score,0);assert.equal(m.privatePlayerState("b").score,0);
  });
}

test("pending response locks every action and rejects unauthorized, stale and malformed replies", () => {
  const m=make({resources:{FIRE:1},skills:{ATTACK:2,PEEK:1,REVEAL:1}}, {resources:{WOOD:2},skills:{DEFENSE:1}});
  m.attackSkill("a","b","WOOD");
  const before=state(m), id=m.publicState().currentTurn.pendingDefense.actionId;
  for(const action of [
    ()=>m.attack("a","b","WOOD"),()=>m.attackSkill("a","b","WOOD"),()=>m.acquire("a",choice()),
    ()=>m.purchase("a","missing"),()=>m.endTurn("a"),()=>m.peekHidden("a","b"),()=>m.revealHidden("a","b",0),
    ()=>m.respondDefense("a",1,id,true),()=>m.respondDefense("b",2,id,true),
    ()=>m.respondDefense("b",1,id+1,true),()=>m.respondDefense("b",1,id,"false"),()=>m.defenseOptions("a"),
  ]){assert.throws(action);assert.deepEqual(state(m),before);}
  respond(m,false);
  const after=state(m);assert.throws(()=>m.respondDefense("b",1,id,true));assert.deepEqual(state(m),after);
});

test("pending public view does not reveal whether a private hand contains defense", () => {
  const a=make({skills:{ATTACK:1}},{resources:{WOOD:1},skills:{DEFENSE:1}});
  const b=make({skills:{ATTACK:1}},{resources:{WOOD:1},skills:{PEEK:1}});
  a.attackSkill("a","b","WOOD");b.attackSkill("a","b","WOOD");
  assert.deepEqual(a.publicState(),b.publicState());
  assert.equal(b.defenseOptions("b").canUseDefenseSkill,false);
  const before=state(b);assert.throws(()=>respond(b,true));assert.deepEqual(state(b),before);
  respond(b,false);assert.equal(b.privatePlayerState("b").skills.PEEK,1);
});

test("peek returns frozen current hidden stock only to its owner and preserves visibility", () => {
  const m=make({skills:{PEEK:1}},{resources:{WOOD:3,FOOD:2},publicResources:{WOOD:1}});
  const before=m.privatePlayerState("b");
  const peek=m.peekHidden("a","b");
  assert.equal(peek.hiddenResources.WOOD,2);assert.equal(peek.hiddenResources.FOOD,2);
  assert.deepEqual(m.privatePlayerState("b"),before);
  assert.equal(m.privatePlayerState("a").peeks.length,1);
  assert.equal(m.privatePlayerState("b").peeks.length,0);
  assert.equal("peeks" in m.publicState().players[0],false);
  assert.equal("hiddenResources" in m.publicState().currentTurn.skillActions[0],false);
  assert.throws(()=>{peek.hiddenResources.WOOD=99;});
  assert.equal(m.privatePlayerState("a").skills.PEEK,0);
});

test("selected face-down slot reveals exactly one token to everyone with no total change", () => {
  const m=make({skills:{REVEAL:2}},{resources:{WOOD:3,FOOD:2},publicResources:{WOOD:1},skills:{DEFENSE:1}});
  const before=m.privatePlayerState("b");
  const r=m.revealHidden("a","b",3);
  assert.equal(r.outcome,"REVEALED");
  const after=m.privatePlayerState("b"), type=r.targetResource;
  assert.equal(after.publicResources[type],before.publicResources[type]+1);
  assert.equal(after.hiddenTokenCount,before.hiddenTokenCount-1);
  assert.equal(after.totalTokens,before.totalTokens);
  assert.equal(m.publicState().players[1].publicResources[type],after.publicResources[type]);
  assert.equal(after.skills.DEFENSE,1);
  assert.equal(m.publicState().currentTurn.pendingDefense,null);
  assert.equal(m.privatePlayerState("a").skills.REVEAL,1);
});

test("invalid skill targets, slots, actors and missing cards leave all state unchanged", () => {
  const m=make({skills:{ATTACK:1,PEEK:1,REVEAL:1}},{resources:{WOOD:1}});
  const before=state(m);
  for(const action of [
    ()=>m.attackSkill("b","a","WOOD"),()=>m.attackSkill("a","a","WOOD"),()=>m.attackSkill("a","missing","WOOD"),
    ()=>m.attackSkill("a","b","GOLD"),()=>m.revealHidden("a","b",-1),()=>m.revealHidden("a","b",1),
    ()=>m.revealHidden("a","b",0.5),()=>m.peekHidden("a","a"),()=>m.peekHidden("b","a"),
  ]){assert.throws(action);assert.deepEqual(state(m),before);}
  const empty=make({skills:{PEEK:1,REVEAL:1}},{resources:{WOOD:1},publicResources:{WOOD:1}});
  const saved=state(empty);assert.throws(()=>empty.peekHidden("a","b"));assert.throws(()=>empty.revealHidden("a","b",0));
  assert.deepEqual(state(empty),saved);
});

test("skills remain usable after purchase, and a newly drawn skill can be used in that turn", () => {
  const m=new TurnManager([{playerId:"a",resources:{WOOD:4,FOOD:3,STONE:3}},{playerId:"b",resources:{WOOD:1}}],
    {deck:[new PointCard("three",3,{WOOD:4,FOOD:3,STONE:3})],skillDeck:["ATTACK"]});
  m.acquire("a",choice());m.purchase("a","three");m.attackSkill("a","b","WOOD");m.endTurn("a");
  assert.throws(()=>m.attackSkill("a","b","WOOD"));
  assert.equal(m.privatePlayerState("a").score,3);
});

test("skill hand does not count toward token capacity and can exceed fifteen cards", () => {
  const p=new Player("a",{skills:{ATTACK:30,DEFENSE:30},resources:{WOOD:15}});
  assert.equal(p.totalTokens,15);assert.equal(p.skillCardCount,60);assert.equal(p.canEndTurn,true);
});

test("rejected reward overflow and failed purchases do not draw or mutate the market", () => {
  const m=new TurnManager([{playerId:"a",skills:{ATTACK:Number.MAX_SAFE_INTEGER},resources:{WOOD:4,FOOD:3,STONE:3}},{playerId:"b"}],
    {deck:[new PointCard("three",3,{WOOD:4,FOOD:3,STONE:3})],skillDeck:["PEEK"]});
  m.acquire("a",choice());const before=state(m);
  assert.throws(()=>m.purchase("a","three"));assert.deepEqual(state(m),before);
});

test("skill defense against every token preserves that target and both scores", () => {
  for(const target of [...RESOURCE_TYPES,"LIVESTOCK"]) {
    const m=make({skills:{ATTACK:1},score:4},{resources:{FIRE:1,WATER:1,STONE:1,WOOD:1,FOOD:1},livestock:1,skills:{DEFENSE:1},score:5});
    const before=m.privatePlayerState("b");
    m.attackSkill("a","b",target);
    const r=respond(m,true);
    assert.equal(r.leaderScoreEligible,false);
    assert.equal(m.privatePlayerState("b").totalTokens,before.totalTokens);
    assert.deepEqual(m.privatePlayerState("b").basicResources,before.basicResources);
    assert.equal(m.privatePlayerState("a").score,4);assert.equal(m.privatePlayerState("b").score,5);
  }
});

test("post-acquisition defense resumes the same phase and blocks purchase and end until answered", () => {
  const m=make({skills:{ATTACK:1}}, {resources:{WOOD:1},skills:{DEFENSE:1}});
  m.acquire("a",choice());m.attackSkill("a","b","WOOD");
  assert.equal(m.publicState().currentTurn.purchaseAvailable,false);
  const before=state(m);assert.throws(()=>m.endTurn("a"));assert.deepEqual(state(m),before);
  respond(m,false);
  assert.equal(m.publicState().currentTurn.phase,"AFTER_ACQUISITION");
  assert.equal(m.publicState().currentTurn.purchaseAvailable,true);
  m.endTurn("a");
});

test("peek history is a historical snapshot, not a live view of subsequent hidden changes", () => {
  const m=make({skills:{PEEK:1,REVEAL:1}},{resources:{WOOD:2}});
  const peek=m.peekHidden("a","b");m.revealHidden("a","b",1);
  assert.equal(peek.hiddenResources.WOOD,2);
  assert.equal(m.privatePlayerState("a").peeks[0].hiddenResources.WOOD,2);
  assert.equal(m.privatePlayerState("b").hiddenResources.WOOD,1);
});

test("ordinary attack blocked by a skill is excluded from both leader bonuses", () => {
  const m=make({resources:{FIRE:1}},{resources:{WOOD:1},skills:{DEFENSE:1}});
  m.attack("a","b","WOOD");const r=respond(m,true);
  assert.equal(r.defenseSkillUsed,true);assert.equal(r.leaderScoreEligible,false);
});
