import test from "node:test";
import assert from "node:assert/strict";
import { PointCard, Market, PurchasePayment, createBetaDeck, Player, Turn, TurnManager, CardPurchase } from "../src/index.ts";

const one = (id = "one") => new PointCard(id, 1, { WOOD: 3, FOOD: 2 });
const three = () => new PointCard("three", 3, { WOOD: 4, FOOD: 3, STONE: 3 });
const acquisition = () => ({ kind: "DISTINCT_THREE", resources: ["FIRE", "WATER", "STONE"], revealedResources: ["FIRE", "WATER"] });
const setup = () => [
  { playerId: "a", resources: { WOOD: 3, FOOD: 2 }, publicResources: { WOOD: 2, FOOD: 1 }, livestock: 1 },
  { playerId: "b" },
];
const snapshot = m => ({ public: m.publicState(), private: ["a", "b"].map(id => m.privatePlayerState(id)) });

test("point cards enforce every tier cost pattern and immutable snapshots", () => {
  for (const [tier, cost] of [[1,{WOOD:4}],[1,{WOOD:3,FOOD:2}],[1,{WOOD:2,FOOD:2,FIRE:1}],
    [2,{WOOD:4,FOOD:3}],[2,{WOOD:3,FOOD:3,STONE:2}],[2,{WOOD:2,FOOD:2,FIRE:2,STONE:2}],
    [3,{WOOD:4,FOOD:3,STONE:3}],[3,{WOOD:3,FOOD:3,FIRE:2,STONE:2}]]) {
    const c = new PointCard("c",tier,cost);
    assert.equal(c.snapshot().victoryPoints,tier);
    assert.equal(c.snapshot().rewardSkillCard,tier===3);
    assert.throws(()=>{c.cost.WOOD=99;});
    cost.WOOD=99;
    assert.notEqual(c.cost.WOOD,99);
  }
  for (const [tier,cost] of [[0,{WOOD:4}],[1,{WOOD:5}],[1,{WOOD:2,FOOD:2}],[1,{WOOD:2,FOOD:1,FIRE:1,STONE:1}],
    [2,{WOOD:7}],[2,{WOOD:4,FOOD:4}],[3,{WOOD:5,FOOD:5}],[3,{WOOD:3,FOOD:3,STONE:3}]]) {
    assert.throws(()=>new PointCard("bad",tier,cost));
  }
  assert.throws(()=>new PointCard("",1,{WOOD:4}));
});

test("beta deck has 40 unique reproducible cards and varies with seed", () => {
  const a=createBetaDeck(1), b=createBetaDeck(1), c=createBetaDeck(2);
  assert.equal(a.length,40);
  assert.equal(new Set(a.map(x=>x.cardId)).size,40);
  assert.deepEqual(a.map(x=>x.cardId),b.map(x=>x.cardId));
  assert.notDeepEqual(a.map(x=>x.cardId),c.map(x=>x.cardId));
  assert.deepEqual([1,2,3].map(t=>a.filter(x=>x.tier===t).length),[15,15,10]);
  assert.throws(()=>createBetaDeck(-1));
});

test("market has 3/2/1 or 4/3/2 public cards and hides draw order", () => {
  for (let players=2;players<=6;players++) {
    const market=new Market(players,createBetaDeck());
    assert.deepEqual([1,2,3].map(t=>market.snapshot().filter(s=>s.tier===t&&s.card).length),players<=3?[3,2,1]:[4,3,2]);
    assert.ok(market.snapshot().every(slot=>Object.keys(slot).join(",")==="tier,card"));
    assert.throws(()=>{market.snapshot()[0].card=null;});
  }
  assert.throws(()=>new Market(1,createBetaDeck()));
  assert.throws(()=>new Market(2,[one(),one()]));
});

test("market replacement preserves tier and uses each card once, then leaves an empty slot", () => {
  const cards=Array.from({length:5},(_,i)=>one("c"+i));
  const market=new Market(2,cards);
  cards.reverse();
  assert.equal(market.snapshot()[0].card.cardId,"c0");
  assert.throws(()=>market.find("c3"));
  market.take("c0");
  assert.equal(market.snapshot()[0].card.cardId,"c3");
  market.take("c3");
  assert.equal(market.snapshot()[0].card.cardId,"c4");
  market.take("c4");
  assert.equal(market.snapshot()[0].card,null);
  assert.throws(()=>market.find("c0"));
  assert.throws(()=>market.take("c4"));
});

test("beta split and same-resource livestock policies accept exact valid replacements", () => {
  const c=one();
  const split=PurchasePayment.plan(c,{WOOD:1,FOOD:1});
  assert.equal(split.resources.WOOD,2);
  assert.equal(split.resources.FOOD,1);
  assert.equal(split.livestock,1);
  assert.throws(()=>PurchasePayment.plan(c,{WOOD:1,FOOD:1},"SAME_RESOURCE"));
  for (const policy of ["BETA_SPLIT","SAME_RESOURCE"]) {
    const same=PurchasePayment.plan(c,{WOOD:2},policy);
    assert.equal(same.resources.WOOD,1);
    assert.equal(same.resources.FOOD,2);
  }
  assert.equal(PurchasePayment.plan(c).livestock,0);
  for (const replacement of [{WOOD:1},{WOOD:3},{WOOD:2,FOOD:2},{FIRE:2},{WOOD:-1,FOOD:3},{GOLD:2}]) {
    assert.throws(()=>PurchasePayment.plan(c,replacement));
  }
  assert.throws(()=>PurchasePayment.plan(c,{},"OTHER"));
});

test("split replacement opens a purchase that the same-resource policy cannot afford", () => {
  const c=one();
  const canPay=p=>p.resources.WOOD<=2&&p.resources.FOOD<=1;
  assert.ok(PurchasePayment.options(c,"BETA_SPLIT").some(canPay));
  assert.equal(PurchasePayment.options(c,"SAME_RESOURCE").some(canPay),false);
});

test("purchase pays public stock first, spends one livestock, scores and replenishes", () => {
  const deck=[one("c0"),one("c1"),one("c2"),one("c3")];
  const m=new TurnManager(setup(),{deck});
  m.acquire("a",acquisition());
  const result=m.purchase("a","c0",{WOOD:1,FOOD:1});
  const p=m.privatePlayerState("a");
  assert.equal(p.score,1);
  assert.equal(p.livestockCount,0);
  assert.equal(p.publicResources.WOOD,0);
  assert.equal(p.hiddenResources.WOOD,1);
  assert.equal(p.publicResources.FOOD,0);
  assert.equal(p.hiddenResources.FOOD,1);
  assert.equal(p.purchasedCards[0].cardId,"c0");
  assert.equal(m.publicState().market[0].card.cardId,"c3");
  assert.equal(result.card.cardId,"c0");
  assert.equal("payment" in result,false);
  assert.equal(m.publicState().currentTurn.purchaseAvailable,false);
  assert.throws(()=>m.purchase("a","c1"),/one point card/);
});

test("bad timing, actor, missing card, replacement and insufficient funds preserve all state", () => {
  const m=new TurnManager(setup(),{deck:[one()]});
  const initial=snapshot(m);
  assert.throws(()=>m.purchase("a","one"),/phase/);
  assert.deepEqual(snapshot(m),initial);
  m.acquire("a",acquisition());
  const before=snapshot(m);
  for (const action of [
    ()=>m.purchase("b","one"),()=>m.purchase("a","missing"),
    ()=>m.purchase("a","one",{FIRE:2}),()=>m.purchase("a","one",{WOOD:1}),
  ]) { assert.throws(action); assert.deepEqual(snapshot(m),before); }
  m.purchase("a","one");
  const poor=new TurnManager([{playerId:"a"},{playerId:"b"}],{deck:[one()]});
  poor.acquire("a",acquisition());
  const unchanged=snapshot(poor);
  assert.throws(()=>poor.purchase("a","one"));
  assert.deepEqual(snapshot(poor),unchanged);
});

test("livestock is never spent without ownership and strict policy is enforced by the engine", () => {
  for (const options of [{deck:[one()]},{deck:[one()],livestockPolicy:"SAME_RESOURCE"}]) {
    const s=setup();s[0].livestock=options.livestockPolicy?1:0;
    const m=new TurnManager(s,options);
    m.acquire("a",acquisition());
    const before=snapshot(m);
    assert.throws(()=>m.purchase("a","one",{WOOD:1,FOOD:1}));
    assert.deepEqual(snapshot(m),before);
  }
  assert.throws(()=>new TurnManager(setup(),{livestockPolicy:"OTHER"}));
});

test("buying is optional, at most one per turn, and becomes available again next turn", () => {
  const s=setup();s[0].resources={WOOD:6,FOOD:4};
  const m=new TurnManager(s,{deck:[one("c0"),one("c1"),one("c2")]});
  m.acquire("a",acquisition()); m.purchase("a","c0"); m.endTurn("a");
  assert.equal(m.publicState().currentTurn.purchaseAvailable,false);
  m.acquire("b",acquisition()); m.endTurn("b");
  m.acquire("a",acquisition()); m.purchase("a","c1");
  assert.equal(m.privatePlayerState("a").score,2);
  m.endTurn("a");
  assert.throws(()=>m.purchase("a","c2"));
});

test("tier-three purchase records three points and one pending skill reward", () => {
  const p=new Player("a",{resources:{WOOD:4,FOOD:3,STONE:3}});
  const turn=new Turn(p);const market=new Market(2,[three()]);
  turn.acquire("a",acquisition());turn.purchase("a",market,"three");
  assert.equal(p.score,3);
  assert.equal(p.pendingSkillRewards,1);
  assert.equal(p.purchasedCards[0].rewardSkillCard,true);
  assert.equal(market.snapshot().find(s=>s.tier===3).card,null);
});

test("score overflow and forged payment fail before spending or removing a card", () => {
  const p=new Player("a",{resources:{WOOD:3,FOOD:2},score:Number.MAX_SAFE_INTEGER});
  const market=new Market(2,[one()]);
  const before=p.basicResources;
  assert.throws(()=>CardPurchase.execute(p,market,"one",{},"BETA_SPLIT"));
  assert.deepEqual(p.basicResources,before);
  assert.equal(market.find("one").cardId,"one");
  assert.equal(p.purchasedCards.length,0);
  const q=new Player("q",{resources:{WOOD:3,FOOD:2},livestock:2});
  for (const payment of [{resources:{},livestock:0},{resources:{WOOD:3,FOOD:1},livestock:0},{resources:{WOOD:3,FOOD:2},livestock:2}]) {
    assert.throws(()=>q.purchasePointCard(one(),payment));
    assert.equal(q.score,0);assert.equal(q.totalTokens,7);
  }
});

test("no extra disclosure of remaining hidden holdings after payment", () => {
  const m=new TurnManager(setup(),{deck:[one()]});
  m.acquire("a",acquisition());m.purchase("a","one",{WOOD:1,FOOD:1});
  const pub=m.publicState();
  assert.equal("hiddenResources" in pub.players[0],false);
  assert.equal("basicResources" in pub.players[0],false);
  assert.throws(()=>{pub.players[0].purchasedCards[0].resourceCost.WOOD=99;});
});

test("purchase from eighteen tokens reduces holdings enough to end without discarding", () => {
  const m=new TurnManager([
    {playerId:"a",resources:{WOOD:7,FOOD:6},publicResources:{WOOD:7,FOOD:6},livestock:2},
    {playerId:"b"},
  ],{deck:[one()]});
  m.acquire("a",acquisition());
  assert.equal(m.privatePlayerState("a").totalTokens,18);
  m.purchase("a","one");
  assert.equal(m.privatePlayerState("a").totalTokens,13);
  m.endTurn("a");
  assert.equal(m.publicState().currentTurn.playerId,"b");
});
