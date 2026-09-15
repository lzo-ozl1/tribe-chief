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

첫 도메인 구현: TypeScript 기반 `ResourceType`, `ResourceInventory`, `Player`와 자동 테스트를 제공합니다.
게임 화면과 전체 턴 엔진은 후속 개발 단계입니다.

구현은 각 단계별 계획을 사용자에게 먼저 제시하고 승인을 받은 후 진행합니다.

## 개발 환경 및 실행

Node.js 24 이상과 npm을 사용합니다. 런타임 외부 의존성은 없으며 TypeScript는 개발 의존성입니다.

```sh
npm install
npm run typecheck
npm test
npm run build
npm run demo
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

획득·사용 메서드는 검증된 행동을 적용하는 기본 모델 API입니다. 턴당 획득 선택지와 행동 횟수 제한은 후속 턴 엔진의 책임입니다.
가축의 카드 구매 가치/유지, 공격·방어, 카드, 부족장, 공개 상태 전송은 아직 구현하지 않았습니다.
