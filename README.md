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
게임 화면, 공격·구매·유지 판정을 포함한 전체 게임 엔진은 후속 개발 단계입니다.

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
가축의 카드 구매 가치/유지, 공격·방어, 카드, 부족장, 실제 네트워크 전송은 아직 구현하지 않았습니다.

## 턴 진행 API

```typescript
import { TurnManager } from "./src/index.ts";

const turns = new TurnManager([{ playerId: "p1" }, { playerId: "p2" }]);
turns.acquire("p1", {
  kind: "DISTINCT_THREE",
  resources: ["FIRE", "WATER", "STONE"],
  revealedResource: "FIRE",
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
- `publicState()`는 점수, 가축 수, 현재 턴 정보와 공개된 자원 종류만 제공합니다. 기본 자원의 보유량, 숨겨진 선택, 총 보유량은 포함하지 않습니다.
- `privatePlayerState(id)`는 신뢰된 엔진/소유자용 조회입니다. 네트워크 연결 시 인증된 사용자와 플레이어 ID의 대응 검증이 별도로 필요합니다.
- 현재 흐름은 `AWAITING_ACQUISITION → AFTER_ACQUISITION → ENDED`입니다. 전체 게임의 공격·구매·유지·부족장·승리 판정을 수행하지 않으며, 가축을 포함한 완전한 게임 규칙 검증용으로 사용할 수는 없습니다.
