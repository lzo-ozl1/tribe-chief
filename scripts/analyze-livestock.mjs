import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createBetaDeck, PurchasePayment, RESOURCE_TYPES } from "../src/index.ts";

const cards = createBetaDeck().map(card => ({
  tier: card.tier,
  plans: Object.fromEntries(["BETA_SPLIT", "SAME_RESOURCE"].map(policy => [
    policy, PurchasePayment.options(card, policy).map(plan => RESOURCE_TYPES.map(type => plan.resources[type])),
  ])),
}));
function* holdings(max, prefix = []) {
  if (prefix.length === 4) {
    for (let last = 0; last <= max; last++) yield [...prefix, last];
    return;
  }
  for (let value = 0; value <= max; value++) yield* holdings(max - value, [...prefix, value]);
}
const affordable = (plans, stock) => plans.some(plan => plan.every((cost, i) => cost <= stock[i]));
function compare(maxBasic, needsMaintenanceResources) {
  const rows = [1, 2, 3].map(tier => ({ tier, cases: 0, withoutLivestock: 0, sameResource: 0, betaSplit: 0, splitOnly: 0 }));
  let states = 0;
  for (const stock of holdings(maxBasic)) {
    if (needsMaintenanceResources && (stock[3] < 1 || stock[4] < 1)) continue;
    states++;
    for (const card of cards) {
      const row = rows[card.tier - 1];
      const none = affordable([card.plans.BETA_SPLIT[0]], stock);
      const strict = affordable(card.plans.SAME_RESOURCE, stock);
      const beta = affordable(card.plans.BETA_SPLIT, stock);
      assert.ok(!strict || beta, "Strict purchase options must be a subset of beta");
      row.cases++; row.withoutLivestock += Number(none);
      row.sameResource += Number(strict); row.betaSplit += Number(beta);
      row.splitOnly += Number(beta && !strict);
    }
  }
  const total = rows.reduce((sum, row) => {
    for (const key of ["cases", "withoutLivestock", "sameResource", "betaSplit", "splitOnly"]) sum[key] += row[key];
    return sum;
  }, { tier: "전체", cases: 0, withoutLivestock: 0, sameResource: 0, betaSplit: 0, splitOnly: 0 });
  return { maxBasic, needsMaintenanceResources, states, rows: [...rows, total] };
}
const results = [compare(14, false), compare(17, false), compare(14, true), compare(17, true)];
const pct = (a, b) => (100 * a / b).toFixed(2) + "%";
const lines = [
  "# 베타 가축 대체 규칙 비교",
  "",
  "## 방법",
  "- 테스트 덱 40장: 1점 15장, 2점 15장, 3점 10장. 같은 비용 패턴을 다섯 자원으로 순환시킨 임시 덱이다.",
  "- 가축 1개를 보유한 동일한 자원 상태에서, 각 카드의 구매 가능 여부를 두 정책으로 전수 비교했다.",
  "- 기본 자원 합계 0–14(가축 포함 최대 15개)와 0–17(획득 후 가축 포함 최대 18개)을 각각 검사했다.",
  "- 자원 분포별/카드별 동일 가중치다. 실제 플레이의 상태 발생 빈도, 구매율, 승률을 뜻하지 않는다.",
  "- '가축 미사용'도 같은 보유 상태에서 가축을 지불하지 않고 구매 가능한지를 뜻한다.",
  "- 추가 민감도 분석은 가축 1개 유지에 필요한 나무·식량이 각각 1개 이상인 상태만 남긴다. 유지 시점/소모 정책을 시뮬레이션하는 것은 아니다.",
  "- 구매 비용은 정확히 충족해야 하며 가축은 최대 1개, 정확히 두 단위를 대체한다. 두 정책 모두 이미 가능했던 구매를 중복 계산하지 않는다.",
  "",
];
for (const r of results) {
  lines.push("## 기본 자원 최대 " + r.maxBasic + "개 / " + (r.needsMaintenanceResources ? "나무·식량 각 1개 이상" : "모든 분포"), "");
  lines.push("보유 상태 " + r.states.toLocaleString("en-US") + "개 × 카드 40장.", "");
  lines.push("| 등급 | 비교 건수 | 가축 미사용 가능 | 같은 종류 2개 대체 가능 | 베타 분할 대체 가능 | 분할로만 추가 가능 |");
  lines.push("|---|---:|---:|---:|---:|---:|");
  for (const row of r.rows) lines.push("| " + row.tier + " | " + row.cases + " | " + pct(row.withoutLivestock, row.cases) + " | " + pct(row.sameResource, row.cases) + " | " + pct(row.betaSplit, row.cases) + " | " + row.splitOnly + " (" + pct(row.splitOnly, row.cases) + "p) |");
  lines.push("");
}
lines.push("## 해석 및 한계", "",
  "- 분할 대체는 같은 종류 대체가 가능한 구매를 모두 포함하며, 서로 다른 두 자원이 각각 1개씩 부족한 상황 등에서 추가 구매를 허용한다.",
  "- 비교 결과는 즉시 구매의 유연성 차이다. 가축 유지비, 상대 공격, 카드 선점, 부족장, 스킬, 턴별 획득 전략과 승리 시점을 포함한 전체 밸런스 평가는 아니다.",
  "- 현 베타 기본값은 BETA_SPLIT을 유지한다. SAME_RESOURCE는 동일 엔진에서 설정으로 비교할 수 있다.",
  "- 실제 베타에서는 정책별 승률, 가축 획득 빈도, 구매까지 걸린 턴, 가축으로 대체한 자원 조합과 유지 실패를 함께 측정해야 한다.",
  "- 재현: npm run analyze:livestock -- docs/LIVESTOCK_BETA_ANALYSIS.md",
  "");
const report = lines.join("\n");
if (process.argv[2]) writeFileSync(process.argv[2], report, "utf8");
else process.stdout.write(report);
console.error(JSON.stringify(results.map(r => ({ maxBasic: r.maxBasic, maintenanceFilter: r.needsMaintenanceResources, states: r.states, totals: r.rows.at(-1) }))));
