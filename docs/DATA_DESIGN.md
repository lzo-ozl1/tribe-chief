# 부족장 — Data Design

## 1. 목적
게임 규칙을 코드로 옮기기 위한 데이터 모델과 객체 간 관계를 정의한다.

## 2. 핵심 도메인 객체
- `Resource`: 기본 자원의 종류와 수량
- `Livestock`: 가축 수량
- `Player`: 플레이어 상태, 자원, 점수, 부족장, 스킬
- `Game`: 게임 전체 상태와 플레이어 목록
- `Turn`: 현재 턴과 턴 진행 상태
- `PointCard`: 점수 카드의 등급, 비용, 점수
- `SkillCard`: 스킬의 종류와 효과
- `TribeLeader`: 부족장 종류와 보너스 규칙
- `Market`: 공개된 점수 카드 시장
- `Attack`: 공격 시도와 결과
- `Defense`: 방어 시도와 결과

## 3. Resource
기본 자원 종류는 `FIRE`, `WATER`, `STONE`, `WOOD`, `FOOD`로 관리한다.

수량은 플레이어의 보유 자원 상태에서 관리한다. 기본 자원은 상대에게 직접 노출하지 않는다.

## 4. Player
주요 상태:
- playerId
- score
- basicResources
- livestockCount
- skillCards
- tribeLeader
- 공개 가능한 자원 정보
- 부족장 보너스 추적 상태

총 보유량은 기본 자원 + 가축의 실제 토큰 수를 합산한다. 15개 한도는 턴 종료 시 적용한다.
턴 중에는 15개를 초과할 수 있으며, 턴 시작에 15개를 보유하더라도 3개를 정상 획득해 18개가 될 수 있다.
턴 중 사용 후에도 15개를 초과하면 플레이어가 초과 수량만큼 버릴 토큰을 선택하고, 15개 이하인 경우에만 턴을 종료한다.
가축 1개는 보유량 계산에서 토큰 1개로 센다.

## 5. PointCard
속성 예시:
- cardId
- tier: 1 / 2 / 3
- victoryPoints
- resourceCost
- rewardSkillCard: boolean

구매 가능한 카드의 비용은 게임 규칙 문서에 정의된 등급별 제약을 따른다.

## 6. SkillCard
속성 예시:
- skillId
- skillType
- effect
- usageRule

스킬의 상세 사용 규칙은 게임 규칙 확정 후 구체화한다.

## 7. TribeLeader
속성 예시:
- leaderId
- leaderType
- description
- bonusCondition
- bonusPoint
- trackingState

부족장은 단순한 수치 보정보다는 플레이어의 전략적 행동을 유도하는 방향으로 설계한다.

## 8. Market
플레이어 수에 따라 공개 카드 수가 달라진다.

2–3인:
- tier 1: 3장
- tier 2: 2장
- tier 3: 1장

4–6인:
- tier 1: 4장
- tier 2: 3장
- tier 3: 2장

카드 구매 후 동일 등급의 카드로 교체한다.

## 9. Game State
게임 상태는 다음을 포함한다.
- players
- currentPlayerIndex
- round/turn 정보
- market
- victoryTarget = 15
- 게임 종료 후보 상태

게임 규칙과 UI 상태를 직접 결합하지 않는다.

## 10. Attack / Defense 데이터
공격에는 최소한 다음 정보가 필요하다.
- attacker
- defender
- attackResource
- targetResource
- defenseResource
- result

현재 상호작용:
- FIRE → WOOD / WATER 방어
- FIRE → FOOD / STONE 방어

방어 자원은 성공 여부와 관계없이 현재 규칙상 소모하지 않는다.

## 11. Livestock Maintenance
유지 비용:
- 가축 1 → WOOD 1 + FOOD 1

유지 가능한 가축 수를 계산하는 순수 로직을 별도 도메인 서비스로 분리하는 것을 우선 검토한다.

## 12. 데이터 은닉
UI/네트워크 계층에서는 다음을 구분한다.
- Public State: 점수, 가축 수, 공개된 자원 종류, 시장 카드 등
- Private State: 기본 자원의 실제 보유량, 비공개 스킬 정보 등

향후 온라인 멀티플레이를 고려하여 서버 권위(authoritative) 구조로 확장할 수 있도록 설계한다.

## 13. 저장 전략
개발 초기:
- 메모리 기반 게임 상태
- JSON 기반 테스트 데이터

MVP 이후:
- 영속 저장 필요성을 검토
- 계정/매치/게임 기록 저장소를 별도 설계

온라인 서비스 단계:
- 서버의 게임 상태를 단일 진실 공급원으로 사용
- 클라이언트에는 해당 플레이어가 볼 수 있는 상태만 전달

## 14. 데이터 설계 원칙
1. 도메인 객체가 자신의 상태와 불변식을 최대한 책임진다.
2. 단순 데이터 구조와 게임 규칙 로직을 무분별하게 혼합하지 않는다.
3. UI가 게임 규칙을 직접 계산하지 않는다.
4. 공개 상태와 비공개 상태를 명확히 분리한다.
5. 향후 온라인/모바일 확장을 방해하지 않는 구조를 우선한다.

## 15. 초기 TypeScript 구현
- `ResourceType`: 다섯 기본 자원 식별자 및 읽기 전용 수량 타입
- `ResourceInventory`: 수량 검증, 추가, 차감, 보유 검사. 복수 자원 변경은 전부 성공하거나 전부 실패한다.
- `Player`: ID, 기본 자원, 가축, 점수를 캡슐화한다.
- `totalTokens` / `excessTokens`: 총 토큰 수와 턴 종료 시 버려야 할 수량
- `discardExcessTokens(selection)`: 현재 초과분과 정확히 같은 수량을 선택하여 버린다. 잘못된 선택은 상태를 변경하지 않는다.
- `assertCanEndTurn()`: 보유량 조건만 검증한다. 전체 턴을 진행하거나 종료하는 메서드는 아니다.
- 생성자는 저장된 턴 중 상태를 복원할 수 있도록 15개 초과 상태도 허용한다.
- 자원 획득 선택지는 `ResourceAcquisition`, 획득/종료 순서는 `Turn`에서 검증한다. 점수 지급 조건은 후속 구현이다.
- `basicResources`는 소유자/엔진용 스냅샷이다. 공개 조회는 `TurnManager.publicState()`에서 별도로 구성한다.

## 16. 획득 및 턴 순환
- `AcquisitionChoice`: `DISTINCT_THREE`(서로 다른 세 자원과 그중 공개할 서로 다른 두 종류) 또는 `PAIR_AND_LIVESTOCK`(기본 자원 한 종류)
- `ResourceAcquisition`: 선택 전체를 검증한 불변 객체. 내부 토큰 내역과 공개할 자원 종류 배열(`resourceTypes`)/가축 획득 수를 구분한다. 서로 다른 3종 획득 시 2종, 같은 자원 2개+가축 획득 시 1종을 공개한다.
- `Turn`: 현재 플레이어, 획득 전/후/종료 상태와 현재 턴의 공개 정보를 관리한다.
- `TurnManager`: 전달받은 2–6명 순서로 턴을 순환하고 마지막 플레이어 종료 시 라운드를 증가시킨다. 입력 상태는 복사하며 변경 가능한 Player를 외부에 반환하지 않는다.
- 턴/라운드 번호는 1부터 시작한다. 이는 구현상의 표시 규약이며 승리 판정의 라운드 종료 규칙을 확정하지 않는다.
- 획득과 공개 정보 반영은 함께 성공한다. 실패 시 획득 기회를 소비하지 않는다.
- 종료 시 초과분 폐기와 다음 플레이어 전환은 함께 성공한다. 종료 결과는 종료한 턴의 공개 스냅샷이며, 이후 현재 턴 조회는 다음 플레이어의 획득 전 상태다.
- 공개 스냅샷에는 기본 자원 수량/총 보유량/비공개 선택/폐기 내역을 담지 않는다. 과거 공개 기록을 저장하는 로그는 후속 범위다.
- 공격, 카드 구매, 가축 유지, 부족장, 승리 판정은 이 턴 모듈에 아직 연결되지 않았다.
