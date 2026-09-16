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

## 11. 현재 구현된 턴 범위
```text
Application: TurnManager (2–6명 순환, 공개/소유자 조회)
  → Domain: Turn (행동자·획득 횟수·종료 조건)
    → Domain: ResourceAcquisition (두 선택지·공개 종류 검증)
    → Domain: Player (토큰 상태와 한도)
```

현재는 자원 획득부터 보유 한도를 맞춰 종료하는 단계까지 구현한다. 전체 규칙의 선택적 공격은 자원 획득 전에 추가해야 하며, 구매·유지·부족장 판정은 종료 전에 별도 도메인 동작으로 연결해야 한다. 미정인 유지 시점 등을 현재 상태 이름으로 확정하지 않는다.

TurnManager는 변경 가능한 도메인 객체를 반환하지 않고 읽기 전용 스냅샷을 제공한다. Player 자체의 획득/사용 메서드는 신뢰된 도메인 내부 조합용이며 클라이언트 명령으로 직접 노출하지 않는다. 네트워크 인증/접근 권한 계층은 후속 범위다.

## 12. 자원 공개 상태 책임
```text
Turn → ResourceAcquisition (공개 획득 수량 산출)
     → Player (가축 포함 원자적 변경)
       → VisibleResourceInventory (공개분 우선 차감)
         → ResourceInventory × 2 (공개/은닉 수량 검증)
TurnManager → 상대용 공개 스냅샷 / 소유자용 전체 스냅샷
```
공개 이력에서 현재 보유량을 재추정하지 않고 현재 재고의 공개 상태를 직접 보존한다. UI는 은닉분의 종류를 계산하지 않는다. 공개 스냅샷에는 총 토큰 수를 포함하고, 은닉 토큰의 종류별 구성은 포함하지 않는다.
