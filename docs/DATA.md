# 데이터 입력과 검증

실제 데이터는 `public/data/atlas.json`, 보호할 수동 기록은 `data/manual.csv` 또는 `data/manual.json`에 저장합니다. 데모 데이터는 브라우저에서만 생성되며 수집·배포 데이터에 저장하지 않습니다.

## 수동 입력

GitHub 저장소 → `data/manual.csv` → 연필 아이콘 → 편집 → Commit changes. 그다음 Actions → Collect data and deploy Pages → Run workflow → main → Run workflow. 실행 완료 후 사이트에 반영됩니다. JSON도 같은 방식으로 편집할 수 있습니다. CSV와 JSON에 같은 ID가 있으면 CSV를 우선합니다.

CSV 첫 행은 다음과 같습니다. 실제 근거를 확인한 행만 추가하세요. 예시 대수를 제공하지 않습니다.

```csv
id,city,model,basis,count,asOf,sourceId,sourceUrl,scope,verification,locked,note
```

| 열 | 입력값 |
|---|---|
| id | 고유한 기록 이름. 같은 기록 정정 시 같은 ID |
| city | atlas.json의 cities에 등록된 ID. 현재 13개 도시 |
| model | cybercab / model_y. 원문에서 차종이 불명이면 unspecified + unknown + unverified만 허용 |
| basis | allocated(배정), deployed(현지 배치), observed(추적 명부·관측), testing(시험), commercial(영업). 불명이면 unknown + unverified |
| count | 출처에서 확인된 0 이상의 정수. 모르면 빈 수치를 등록하지 말고 소식/서비스에 기록 |
| asOf | 근거의 기준 시각. `2026-10-23T08:00:00+09:00`처럼 시차 포함. 미확인이면 빈칸 + unverified |
| sourceId | manual 또는 sources에 등록된 출처 ID |
| sourceUrl | 실제 근거를 읽을 수 있는 HTTPS 원문 URL |
| scope | 예: ‘오스틴 Tesla 소유 전체 현지 배치 차량’. 범위 변경 시 문구도 변경 |
| verification | official_single / independent / unofficial / estimated / unverified / conflict |
| locked | true 권장. 자동 수집으로 해당 ID를 덮어쓰지 않음 |
| note | 원문의 의미·제한·안전요원 정보 등 |

시장 추정과 비교하려면 추가 열 `scopeId`, `vehicleDefinition`, `coverageComplete`가 필요합니다. 예: Census 오스틴 시 범위 `us:place:4805000`, Tesla 전체 보유 차량 `tesla_owned_fleet`, 두 차종 각각 전체 범위 확인 `true`. 일반 텍스트 `scope`만으로 지역 일치를 추론하지 않습니다. 범위·기준일·정의·완전성이 검증되지 않으면 현재 배치 대수는 표시해도 시나리오 대비 비율은 계산하지 않습니다.

독립 복수 검증은 JSON의 `independentGroups` 배열 또는 CSV의 `independentGroups` 열에서 `tesla|regulator`처럼 서로 다른 원출처 그룹 2개 이상이 필요합니다. 언론의 같은 게시물 재인용 2건은 같은 그룹입니다. 검증 수준은 사람이 원문을 검토한 분류이며 AI가 자동으로 공식 검증을 부여하지 않습니다.

미검증이며 기준일이 없는 사용자 예시 343·312·108은 모든 합계에서 제외됩니다. 오스틴 343·312는 차종도 unspecified로 보존합니다. 기준일과 집계 기준을 추측해 채우지 않습니다. 원문 기준이 모호하면 입력을 보류하거나 unverified로 유지하세요.

## 정정과 충돌

같은 ID의 값을 정정하면 `atlas.json`의 revisions에 이전 값·새 값·정정 시각을 저장합니다. 서로 다른 ID라도 도시·차종·기준·기준 시각이 같은데 범위나 대수가 다르면 합계에서 제외하고 원본 두 행을 보존합니다. 수동 잠금은 관리자가 확인하고 선택한 정정값으로 우선합니다. 잠금만으로 검증 상태가 올라가지는 않습니다.

asOf는 실제 근거의 시각, collectedAt은 최초 수집 시각입니다. 재실행할 때 수치의 날짜를 오늘로 바꾸지 않습니다. 일별 스냅샷은 `data/snapshots/YYYY-MM-DD.json`에 한국 날짜로 저장하고 같은 날 재실행하면 갱신합니다. Git 커밋에도 변경 이력이 남습니다.

총계는 동일 집계 기준의 최신 도시·차종 기록 중 확인된 부분 합계입니다. 다른 날짜의 마지막 확인값이 포함될 수 있으므로 각 도시의 기준일을 함께 확인하세요. 전 세계 전체 대수가 아닙니다. 증감은 같은 도시·차종·기준·범위의 자료가 양일 모두 있을 때만 계산하며, 이월값은 새 관측으로 취급하지 않습니다. 지역 이동은 동일 범위 재고 순변화에만 반영하고 신규 생산 증가로 표현하지 않습니다.

## 서비스와 소식

메인의 ‘언제, 어떤 차종이 늘었나’는 텍사스 공식 등록과 도시별 추적 명부를 분리합니다. 등록 이력은 `monitoring.json`의 `registrationHistory`에 성공한 조회만 보존합니다. 처음 확보한 기록은 증감 없이 첫 확인으로 표시하고, 누락된 날짜는 생성하지 않습니다. 날짜별 표는 각 한국 날짜의 마지막 확인값을 직전 확인 날짜와 비교합니다. 2일 이상 간격이면 며칠간의 차이인지 표시하며 전일 증가로 표현하지 않습니다. 시간별 상세 기록은 그 날짜의 순변화에 포함되므로 표와 다시 합산하지 않습니다.

기존 등록 이력은 저장소에 실제 남은 공식 수집 스냅샷만 사용해 복원했습니다. `node scripts/backfill-registration-history.mjs`로 검토하고 `--write`로 저장할 수 있습니다. 전체 Git 이력이 있어야 최초 복원이 완전하며, 이후 수집기는 저장된 이력을 자동 보존합니다. 차량의 실제 신규 등록일·제조일은 확인하지 못했으므로 표시 날짜는 확인 날짜입니다. 도시 명부는 동일 지역·차종·출처·집계 범위의 관측과 정정 전 스냅샷을 비교하고, 미검증 참고값은 제외합니다.

`services`는 도시 하나에 여러 차종·서비스 행을 저장할 수 있습니다. status는 commercial / limited / testing / preparing / planned / suspended / unknown. safety는 yes / no / unknown. 차종이 명시되지 않은 서비스는 unspecified로 저장합니다. 허가를 서비스로, 목격을 상업운행으로 변환하지 않습니다. 서비스 문장에서 도시가 사라져도 운영 중단으로 바꾸지 않고 재검토 상태로 남깁니다.

`news`의 eventDate(실제 사건일), publishedAt(게시일), firstCollectedAt(최초 수집일)은 별개입니다. undated 공식 웹페이지는 앞의 두 날짜를 null로 유지합니다. ‘오늘 새로 확인’은 firstCollectedAt의 한국 날짜입니다.

## 무료 수집 범위와 제한

- Tesla 지원/FAQ: 명시된 서비스 문장만 규칙 기반 추출. 숫자는 추론하지 않음. 원문이 403이면 이전 서비스 기록·기준일 보존.
- Tesla Q3 PDF / California DMV: 접근·내용 해시 변경 감지. DMV 허가를 차량 수나 특정 도시의 운행으로 변환하지 않음. PDF 차량 수 자동 추출 미연결.
- 새로운 Tesla 공시는 `sources`와 수집 어댑터에 추가해야 함. 현재 Q3 공시 URL은 고정된 문서이며 새 분기 공시를 자동 발견하지 않음.
- X 원문: 403으로 미열람. 공식 API/로그인 미연결.
- RobotaxiTracker 직접 API: 자동 접근 금지 403. 이를 우회하지 않음. Pioneerlands 공개 미러의 지역별 집계 뷰를 수집. 누적 명부이며 최근 30일 영업 차량 수가 아님. Bay Area는 샌프란시스코 시 대수로 편입하지 않음.
- TxDMV 등록부: 공식 UI가 사용하는 공개 JSON을 페이지별 수집. VIN 중복 제거·차종 별칭 정규화 후 집계만 저장. VIN 원문은 저장·배포하지 않음. 주 등록 수치를 도시별로 배분하지 않음.
- FSD Database: 공개 집계 JSON. 같은 TxDMV 자료를 사용하므로 독립 검증으로 세지 않음.
- Tesla 안전 페이지: 정상 조회 때 확인한 신규 계획은 원래 확인일로 보존. 이후 403은 실패로 기록. 계획을 운행으로 바꾸지 않음.
- 51개 관할 문서·해외 문서·공개 RSS: [점검 범위](COVERAGE.md)와 public/data/monitoring.json. 모든 주의 수치·서비스 변경 자동 해석까지 완성된 것은 아님.

유료 API, 프록시, AI 서비스는 사용하지 않습니다. 사이트에는 API 키가 필요 없습니다. GitHub Actions가 자동 제공하는 GITHUB_TOKEN만 사용합니다. 접근 차단을 우회하거나 세션 쿠키를 저장하지 않습니다.
