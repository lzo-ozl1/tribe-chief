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

수량은 플레이어의 공개/은닉 재고에서 관리한다. 공개분은 종류별 수량을 상대에게 보여주고, 은닉분은 합계만 보여준다.

## 4. Player
주요 상태:
- playerId
- score
- basicResources
- livestockCount
- skillCards
- tribeLeader
- publicResources: 공개된 기본 자원 종류별 수량
- hiddenResources: 은닉 기본 자원 종류별 수량(소유자 전용)
- hiddenTokenCount / totalTokens: 공개 가능한 개수
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
- Public State: 점수, 가축 수, 공개 재고 종류별 수량, 은닉 토큰 개수, 총 토큰 수, 공개 획득 정보, 시장 카드 등
- Private State: 기본 자원의 종류별 전체/은닉 보유량, 비공개 스킬 정보 등

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
- 공개 스냅샷에는 공개 재고 수량과 전체/은닉 토큰 개수를 담는다. 은닉 종류별 수량, 비공개 선택, 은닉 폐기 내역을 담지 않는다. 과거 공개 기록을 저장하는 로그는 후속 범위다.
- 일반 공격/자동 방어는 획득 전에 연결되었다. 스킬, 카드 구매, 가축 유지, 부족장, 승리 판정은 아직 연결되지 않았다.

## 17. 공개·은닉 재고 구조
- `VisibleResourceInventory`는 공개/은닉 `ResourceInventory` 두 개를 소유한다.
- `snapshot()`은 합산 재고, `publicSnapshot()`은 공개 재고, `hiddenSnapshot()`은 소유자용 은닉 재고다.
- `spend()`는 종류별로 공개분 → 은닉분 순서로 차감한다. 다른 종류의 공개분으로 대체하지 않는다.
- 전체 요청을 먼저 검증하여 일부 종류만 차감되거나 가축만 차감되는 상태를 방지한다.
- `PlayerInitialState.resources`는 종류별 총량이며 `publicResources`는 그 부분집합이다. 은닉분은 차이로 계산한다. 공개분이 총량을 초과하면 거부한다.
- 기존 초기 상태에 공개 정보가 없으면 전부 은닉으로 간주한다. 과거 획득의 공개 여부를 임의로 복원하지 않는다. 초기 자원 지급 규칙 자체를 정한 것은 아니다.
- `Player.acquireTokens(amounts, publicResources)`의 두 번째 인수는 획득분 중 공개 수량이다. 생략하면 비공개 획득으로 간주하는 신뢰된 엔진 API다.
- 실제 턴 획득은 `ResourceAcquisition.publicResources`를 함께 전달하여 서로 다른 3종은 2개 공개/1개 은닉, 같은 2개+가축은 모두 공개로 저장한다.
- `spendTokens`는 일반 공격 비용·피해 및 후속 구매 로직이 사용하는 공통 차감 API다. 행동의 적법성은 각 행동 시스템에서 검증한다.
- 은닉 전용 보유 한도는 두지 않는다. 총 보유량 15개 제한은 기존대로 턴 종료에만 적용한다.

## 18. 일반 공격과 자동 방어 구현
- `BasicAttackResolver`: 나무/식량에 대한 일반 불 공격만 처리한다. 공개·은닉 합산 보유량으로 판단한다.
- `BasicAttackResult`: 공격자 ID, 방어자 ID, 지정 자원, `HIT / DEFENDED / VOID` 결과만 포함한다.
- `HIT`: 대상 자원 1개를 공개분부터 차감한다. 공격자의 불은 유지하며 은닉 불로 공격한 경우 사용한 1개를 공개로 전환한다.
- `DEFENDED`: 물 또는 돌로 자동 방어하고 공격자의 불 1개를 공개분부터 차감한다. 공개 방어 토큰이 없으면 은닉 방어 토큰 1개를 공개로 이동한다.
- `VOID`: 지정한 자원이 없어 공격이 무효가 된다. 다른 종류로 전환하지 않으며 불은 유지한다. 은닉 불로 공격한 경우 사용한 1개를 공개로 전환한다.
- `Turn.attack`: 획득 전, 현재 플레이어의 요청만 허용한다. 유효한 요청의 모든 결과는 공격 기회를 소모한다.
- 자원 획득을 먼저 성공시키면 공격을 생략한 것으로 처리한다. 잘못된 획득 요청은 아직 남은 공격 기회를 소모하지 않는다.
- 불이 없거나 대상 종류/상대가 잘못된 요청은 입력 오류다. 공격 결과를 생성하거나 기회를 소모하지 않는다.
- `attackAvailable`은 턴 시점/횟수 정보이며 불 보유 여부를 뜻하지 않는다. 불 보유 여부는 실제 공격 요청에서 검사한다.
- `TurnManager.attack(playerId, defenderId, target)`이 등록된 상대를 찾아 Turn에 전달한다.
- `revealResources`/`VisibleResourceInventory.reveal`은 은닉 재고를 공개 재고로 옮기며 총량을 보존한다.
- 일반 공격 결과를 후속 부족장 시스템이 사용할 수 있지만 이번 단계에서는 점수를 자동 지급하지 않는다. 스킬 카드도 아직 전투에 연결하지 않았다.
