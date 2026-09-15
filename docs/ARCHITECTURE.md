# 부족장 — Architecture

## 1. 목표
게임 규칙을 독립적인 도메인 로직으로 구현하고, 브라우저 UI 및 향후 모바일/온라인 환경과 분리한다.

## 2. 핵심 원칙
- OOP 기반 설계
- 단일 책임 원칙을 우선
- 도메인 로직과 UI 분리
- 도메인 로직과 저장소 분리
- 의존성 방향을 명확하게 유지
- 테스트 가능한 순수 로직을 최대화
- 향후 서버/모바일 확장을 고려하되 초기 구현을 과도하게 복잡하게 만들지 않는다.

## 3. 권장 계층
```text
UI / Presentation
        ↓
Application / Game Flow
        ↓
Domain
        ↓
Infrastructure
```

### Domain
게임 자체의 규칙을 담당한다.
- Player
- Game
- Turn
- Resource
- PointCard
- SkillCard
- TribeLeader
- Attack
- Defense
- LivestockMaintenance

### Application
도메인 객체를 조합하여 실제 게임 흐름을 실행한다.
- 턴 시작/종료
- 공격 처리
- 자원 획득
- 카드 구매
- 가축 유지
- 승리 조건 검사

### Presentation
사용자에게 상태를 보여주고 입력을 전달한다.
- 화면
- 버튼
- 카드 표시
- 자원 표시
- 로그

UI는 게임 규칙을 직접 구현하지 않는다.

### Infrastructure
저장, 네트워크, 외부 시스템 연결을 담당한다.

## 4. 클래스 설계 원칙
- 클래스는 명확한 책임을 가진다.
- 거대한 `GameManager` 하나에 모든 규칙을 넣지 않는다.
- 조건문이 반복되면 책임 있는 객체 또는 도메인 서비스로 분리한다.
- 외부 계층에서 도메인 내부 상태를 임의로 변경하지 않는다.
- 불변이어야 하는 값은 변경 불가능한 구조를 우선한다.

## 5. 의존성 원칙
```text
Presentation → Application → Domain
Infrastructure → Application/Domain의 인터페이스 구현
```

Domain은 특정 UI 프레임워크, DB, 네트워크 구현에 직접 의존하지 않는 것을 원칙으로 한다.

## 6. 게임 엔진 방향
게임 엔진은 다음과 같은 순수한 명령 흐름을 지원해야 한다.

```text
StartTurn
 → OptionalAttack
 → AcquireResource
 → PurchaseCard
 → MaintainLivestock
 → ApplyLeaderBonus
 → EnforceCapacity
 → EndTurn
```

실제 구현 시 확정된 규칙과 테스트를 기준으로 순서를 최종 확정한다.

## 7. 상태 변경
게임 상태를 변경하는 행위는 가능한 한 명시적인 도메인 행동으로 표현한다.
예:
- `player.acquireResources(...)`
- `player.purchaseCard(...)`
- `game.resolveAttack(...)`
- `game.maintainLivestock(...)`

단순 setter를 이용하여 외부에서 게임 상태를 자유롭게 변경하는 구조는 피한다.

## 8. 확장성
초기에는 PC 브라우저에서 빠르게 테스트할 수 있도록 구현한다.

단, 다음 확장을 고려한다.
- 반응형 모바일 UI
- AI 플레이어
- 온라인 멀티플레이
- 계정/로비
- iOS/Android 패키징

확장 가능성을 고려하되 실제 필요 이상의 추상화는 만들지 않는다.

## 9. 성능 원칙
- 불필요한 객체 생성 최소화
- 동일 계산의 반복 최소화
- 게임 상태 전체를 매번 복사하는 방식은 필요한 경우에만 사용
- UI 렌더링과 게임 상태 계산을 분리
- 네트워크 단계에서는 공개 상태만 전송
- 최적화는 측정 가능한 병목을 우선 대상으로 한다.

## 10. 테스트 가능성
도메인 규칙은 UI 없이 테스트할 수 있어야 한다.
최소 테스트 대상:
- 자원 획득
- 보유 한도
- 공격/방어
- 가축 유지
- 카드 구매 가능 여부
- 부족장 보너스
- 15점 승리 조건
