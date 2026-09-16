# 부족장 (Tribe Chief)

선사시대 부족의 생존과 경쟁을 테마로 한 전략 보드게임 기반 모바일 게임 프로젝트입니다.

## 프로젝트 목표

자원 관리, 숨겨진 정보, 공격/방어, 부족장별 전략을 결합한 2–6인 경쟁 게임을 개발합니다.

초기 개발 및 규칙 검증은 PC 브라우저에서 진행하고, UI는 모바일 화면에 대응하도록 설계한 뒤 최종적으로 iOS/Android 앱으로 확장합니다.

## 핵심 게임 구조

```text
자원 획득
  ↓
공격 / 방어
  ↓
점수 카드 구매
  ↓
부족장 보너스
  ↓
15점 도달
```

## 문서

- [게임 설계](docs/GAME_DESIGN.md) — 게임의 확정 규칙과 미정 사항
- [데이터 설계](docs/DATA_DESIGN.md) — 핵심 도메인 객체와 데이터 구조
- [아키텍처](docs/ARCHITECTURE.md) — 시스템/클래스 구조와 계층 설계
- [개발 규칙](docs/DEVELOPMENT_RULES.md) — OOP, 승인 절차, Git/PR, 테스트, 최적화 규칙

## 개발 원칙

1. OOP 기반 설계
2. 계획 → 사용자 승인 → 구현
3. 기능별 클래스/모듈 분리
4. 게임 규칙 임의 변경 금지
5. 성능과 유지보수성을 함께 고려
6. 테스트 가능한 도메인 로직 우선
7. GitHub Commit/PR을 통한 변경 이력 관리

## 개발 로드맵

1. 게임 규칙 확정
2. 데이터 설계
3. 아키텍처 확정
4. 게임 엔진 MVP
5. 브라우저 UI
6. AI 플레이어
7. 온라인 멀티플레이
8. 계정/로비
9. 밸런스 및 플레이테스트
10. 모바일 앱
11. 출시 준비

## 현재 상태

TypeScript 기반 자원·플레이어 모델과 자원 획득/턴 순환 모듈을 제공합니다.
2–6명이 지정된 순서로 두 가지 획득 방식 중 하나를 선택하고, 턴 종료 시 보유 한도를 맞춘 뒤 다음 플레이어로 진행할 수 있습니다.
일반 공격·자동 방어, 테스트 덱 시장과 턴당 1장 구매를 지원합니다. 게임 화면, 실제 스킬 배정·사용, 가축 유지·부족장·승리 판정을 포함한 전체 게임 엔진은 후속 개발 단계입니다.

구현은 각 단계별 계획을 사용자에게 먼저 제시하고 승인을 받은 후 진행합니다.

## 개발 환경 및 실행

Node.js 24 이상과 npm을 사용합니다. 런타임 외부 의존성은 없으며 TypeScript는 개발 의존성입니다.

```sh
npm install
npm run typecheck
npm test
npm run build
npm run demo
npm run demo:turn
npm run demo:visibility
npm run demo:combat
npm run demo:purchase
```

번들 pnpm을 사용하는 환경에서는 `pnpm install --frozen-lockfile` 후 `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm demo`로 실행할 수 있습니다.
Node.js의 내장 TypeScript 실행 기능은 타입 검사 없이 실행하므로 `typecheck`를 별도로 실행해야 합니다.
프로세스 생성이 제한된 환경의 테스트: `node --test --test-isolation=none tests/*.test.mjs`.

## 프로젝트 구조

```text
src/
  domain/
    resource/  # 자원 타입과 보유량
    player/    # 플레이어 토큰 및 점수
    shared/    # 수량 검증
    turn/      # 한 턴의 획득/종료 상태
  application/ # 플레이어 순환과 공개/비공개 조회
  index.ts     # 도메인 공개 API
examples/      # 15 → 18 → 15 실행 예제
tests/         # Node.js 내장 테스트 러너
docs/          # 게임·설계·개발 기준
```

## 토큰 보유량 예제

```typescript
import { Player } from "./src/index.ts";

const player = new Player("p1", {
  resources: { WOOD: 7, FOOD: 6 }, livestock: 2,
});
player.acquireTokens({ resources: { FIRE: 1, WATER: 1, STONE: 1 } });
// 총 18개, 초과분 3개. 턴 중 초과 보유는 정상이다.
player.discardExcessTokens({ resources: { WOOD: 2 }, livestock: 1 });
player.assertCanEndTurn(); // 총 15개: 보유량 조건 충족
```

`Player`는 기본 모델 API이고, 획득 선택지와 중복 획득 제한은 `Turn`/`TurnManager`를 통해 적용합니다.
가축의 카드 구매 대체는 구현했습니다. 가축 유지, 스킬 전투, 부족장, 실제 네트워크 전송은 아직 구현하지 않았습니다.

## 턴 진행 API

```typescript
import { TurnManager } from "./src/index.ts";

const turns = new TurnManager([{ playerId: "p1" }, { playerId: "p2" }]);
turns.acquire("p1", {
  kind: "DISTINCT_THREE",
  resources: ["FIRE", "WATER", "STONE"],
  revealedResources: ["FIRE", "WATER"],
});
turns.endTurn("p1");
turns.acquire("p2", { kind: "PAIR_AND_LIVESTOCK", resource: "FOOD" });
turns.endTurn("p2");
console.log(turns.publicState().round); // 2
```

- 배열 순서는 호출자가 정한 순서입니다. 선 플레이어/부족장 배정 규칙을 결정하지 않습니다.
- 턴마다 획득은 정확히 한 번이며, 현재 플레이어만 획득·종료할 수 있습니다.
- 초과 보유 시 `endTurn(playerId, { resources: { WOOD: 2 }, livestock: 1 })`처럼 초과분을 정확히 지정합니다.
- 잘못된 획득/폐기/종료 요청은 상태와 턴 순서를 변경하지 않습니다.
- `publicState()`는 점수, 가축 수, 현재 턴, 공개 재고의 종류별 수량, 은닉 토큰 개수, 총 보유량을 제공합니다. 은닉분의 종류별 수량은 포함하지 않습니다.
- `privatePlayerState(id)`는 신뢰된 엔진/소유자용 조회입니다. 네트워크 연결 시 인증된 사용자와 플레이어 ID의 대응 검증이 별도로 필요합니다.
- 현재 흐름은 `AWAITING_ACQUISITION → AFTER_ACQUISITION → ENDED`입니다. 첫 단계에서 일반 공격을 최대 1회 할 수 있고, 자원 획득을 선택하면 공격 단계가 닫힙니다. 획득 후 최대 1장 구매가 가능합니다. 실제 스킬 배정·사용, 유지·부족장·승리 판정은 아직 수행하지 않습니다.

### 자원 공개 규칙
- 서로 다른 자원 3종 획득: 가져온 3종 중 서로 다른 2종을 `revealedResources`로 지정해 공개합니다. 나머지 1종은 비공개입니다.
- 같은 자원 2개 + 가축 1개 획득: 해당 기본 자원 1종을 공개합니다.
- 획득 공개 결과는 `resourceTypes` 배열이며, 공개해서 가져온 토큰은 재고에서도 계속 공개됩니다. 총 토큰 수와 은닉 개수는 공개하고 은닉분의 종류별 수량은 공개하지 않습니다.

## 공개·은닉 재고
- 공개 토큰부터 같은 종류의 비용·손실·폐기를 차감하고 부족분만 은닉분에서 차감합니다.
- 가축은 항상 공개합니다. 은닉 10개 이상의 별도 제한은 없으며, 턴 종료 시 총 15개 제한을 따릅니다.
- `Player.basicResources`는 합산 재고, `publicResources`와 `hiddenResources`는 각각의 재고입니다. 상대용 상태에는 `hiddenResources`를 전달하지 않습니다.
- 초기화 시 `resources`는 총량이고 `publicResources`는 그중 공개된 양입니다. 예: `new Player("p1", { resources: { WOOD: 3 }, publicResources: { WOOD: 2 } })`는 공개 나무 2개 + 은닉 나무 1개입니다.
- 기존 초기화 데이터에 공개 정보가 없으면 은닉으로 유지합니다. 턴 획득은 확정된 공개 규칙을 자동 적용합니다.
- `npm run demo:visibility`는 4턴 획득 후 식량 1·돌 1·가축 1을 사용한 공개/은닉 상태를 보여줍니다.
- 일반 공격의 비용·피해와 구매 비용은 같은 공개분 우선 차감 구조를 사용합니다.

## 일반 공격 API

```typescript
const turns = new TurnManager([
  { playerId: "p1", resources: { FIRE: 2 }, publicResources: { FIRE: 1 } },
  { playerId: "p2", resources: { WOOD: 2, WATER: 2 } },
]);
const result = turns.attack("p1", "p2", "WOOD");
// DEFENDED: p1 불 1개 소모, p2 은닉 물 중 1개 공개 전환(소모 없음)
console.log(result.outcome);
```

- 공격 대상은 나무/식량만 지정합니다. 나무는 물, 식량은 돌로 자동 방어합니다.
- 성공하면 상대 대상 자원 1개만 소멸하고 불은 유지됩니다.
- 대상 자원이 없으면 무효이며, 불은 유지하지만 턴의 공격 기회는 소모합니다. 대상 전환은 없습니다.
- 불 미보유, 자기 자신/없는 플레이어/잘못된 자원 지정은 요청 오류로 처리합니다.
- 공개 방어 토큰이 이미 있으면 은닉 방어 토큰을 추가 공개하지 않습니다.
- 공격을 먼저 하지 않고 `acquire`를 실행하면 그 턴의 공격 기회는 종료됩니다.
- 실행 예제: `npm run demo:combat`. 스킬과 부족장 점수는 아직 구현하지 않았습니다.

공격 사실·공격자·상대·지정 자원·결과는 모두 공개됩니다. 은닉 불로 공격해 불이 남으면 사용한 1개가 공개로 전환됩니다. 방어에 막혀 불이 소모되면 다른 은닉 불은 공개하지 않습니다.

## 점수 카드 구매와 베타 덱
```typescript
import { TurnManager, createBetaDeck } from "./src/index.ts";
const turns = new TurnManager([{ playerId: "p1" }, { playerId: "p2" }], {
  deck: createBetaDeck(20260916),
  livestockPolicy: "BETA_SPLIT", // 비교 모드: SAME_RESOURCE
});
const market = turns.publicState().market;
// 획득 이후, 보유량이 충분할 때:
// turns.purchase("p1", market[0]!.card!.cardId, { WOOD: 1, FOOD: 1 });
```

- 가축 대체 인수는 카드 비용에서 대신 낼 자원 2개입니다. 가축 1개를 소모하며 카드당 최대 1개만 사용할 수 있습니다.
- 구매 성공 시 비용 차감·점수 지급·구매 카드 기록·동일 등급 시장 보충을 처리합니다.
- 3점 카드는 `pendingSkillRewards`를 1 늘립니다. 실제 스킬의 종류 배정/사용은 후속 구현입니다.
- 기본 테스트 덱은 1점 15장, 2점 15장, 3점 10장입니다. 같은 시드이면 같은 순서로 생성됩니다. 최종 밸런스 덱은 아닙니다.
- 해당 등급 덱 소진 시 슬롯은 비워 둡니다. 베타의 명시적인 처리이며 최종 소진 규칙은 별도 결정합니다.
- `npm run demo:purchase`: 다른 두 자원을 가축으로 대체하여 구매하는 예제
- `npm run analyze:livestock -- docs/LIVESTOCK_BETA_ANALYSIS.md`: 두 대체 정책의 전수 비교 재현
- [가축 비교 결과와 분석 한계](docs/LIVESTOCK_BETA_ANALYSIS.md)
