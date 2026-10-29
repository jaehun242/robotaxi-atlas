# Robotaxi Tracker 출처와 집계 기준

확인일: 2026-10-29. ROBOTAXI ATLAS는 미국의 도시별 추적 현황을 Robotaxi Tracker 기준으로 읽되, 다른 뜻의 수치를 하나로 합산하지 않는다. 여기서 확인한 값은 별도 표기한 공개 미러의 실제 응답이며 Robotaxi Tracker의 현재 화면과 완전히 같다고 단정하지 않는다.

## 원자료와 수집 경로

- 원자료: [Robotaxi Tracker / Ethan McKanna](https://robotaxitracker.com/). 독립 커뮤니티 서비스이며 Tesla의 공식 통계가 아니다.
- 실제 자동 수집: [Pioneerlands Cybercab Tracker](https://pioneerlands.org/cybercabtracker)가 공개 화면에 사용하는 지역별 집계 미러. 원자료와 미러는 독립된 두 출처로 검증한 것이 아니다.
- 수집기는 공개 진입 HTML의 실제 정적 자산에서 공개 익명 읽기 클라이언트를 확인한 뒤 `cybercab_fleet_by_area`의 지역별 숫자와 `cybercab_scrape_runs`의 성공 시각만 읽는다. 개별 차량·번호판·VIN·좌표를 조회하거나 저장하지 않는다. 공개 익명 클라이언트 설정은 메모리에서만 사용하며 키와 요청 헤더를 로그나 데이터 파일에 저장하지 않는다.
- `Cybercab`은 미러 집계의 `cybercab`, `Model Y`는 동일 미러의 `total - cybercab`으로 계산한 파생값이다. 서로 다른 날짜·사이트의 총계로 차종을 역산하지 않는다.

## 같은 사이트의 서로 다른 숫자

정의는 [Methodology](https://robotaxitracker.com/methodology), [Cybercab](https://robotaxitracker.com/cybercab), 홈의 공개 설명과 해당 화면의 공개 정적 자산으로 확인했다.

| 표시 | 뜻 | 해석하면 안 되는 것 |
| --- | --- | --- |
| In service / vehicles here | 커뮤니티에서 추적한 비시험 차량 중 추정 은퇴 차량을 제외한 명부. 추정 은퇴는 30일 이상 미목격이며 확인하는 등록 명부에서도 사라진 경우다. Texas에서는 TxDMV와 Tesla 차량 조회 기록을 사용하며 다른 주에는 같은 등록 검증이 없을 수 있다. | 지금 동시에 유료 영업 중인 차량 수, 최근 30일 목격 수, 완전한 실제 총계 |
| Tracked all-time / logged by riders | 커뮤니티에 누적 기록된 서로 다른 차량. 서비스 중단·미목격·시험 필터를 적용한 현재 화면과 다를 수 있다. | 현재 영업·현재 배치 대수 |
| On Tesla's lookup | Texas 등록 차량 중 Tesla의 Robotaxi 차량 조회에 해당 지역으로 등재된 차량. 조회 시각과 지연이 있다. | 그 도시에서 당일 유료 운행한 사실, 실시간 위치 |
| Registered in Texas | Texas 주 AV 등록 명부의 Tesla 차량. Cybercab 등록 누적선은 해당 명부 기준이다. | Austin 한 도시의 현지 배치·영업 대수 |
| Camera sightings | 카메라 감지 건수. 같은 차량을 여러 카메라가 감지할 수 있다. | 고유 차량 수 |
| ATLAS 공개 미러 명부 | Pioneerlands가 읽어 제공한 지역별 커뮤니티 기록. 원본의 현재 in-service 필터와 동기화 여부는 공개 집계만으로 보장할 수 없다. | 원본 현재 화면과의 숫자 일치 보장, 등록·영업 대수 |

따라서 Texas 등록 Cybercab 573대를 Austin 커뮤니티 명부 229대에 덮어쓰지 않는다. 573의 등록 범위와 Austin 귀속 주장 등 기존 별도 참고 자료는 원래 출처·기준일·검증 상태를 유지한다. 상업운행 여부나 안전요원 유무도 차량 명부 숫자만으로 판정하지 않는다.

## 실제 공개 미러 수집 확인

성공한 미러 실행 시각 `2026-10-29T09:07:02.100Z`의 집계를 읽었다. 아래 시각은 미러 실행 시각이지 모든 차량의 새 목격일이나 통계의 공식 발표일이 아니다.

| 미러 지역 | Cybercab | Model Y (파생) | 합계 |
| --- | ---: | ---: | ---: |
| Austin | 229 | 236 | 465 |
| Dallas | 1 | 77 | 78 |
| Houston | 0 | 43 | 43 |
| Miami | 0 | 5 | 5 |
| Orlando | 0 | 8 | 8 |
| Tampa | 0 | 25 | 25 |
| Bay Area | 0 | 759 | 759 |

Bay Area는 San Francisco 시와 다른 광역 범위이므로 도시 합계·비율에 넣지 않는다. 이 표의 0은 미러 명부에 해당 차종 기록이 0건이라는 뜻이며 실제 도시 차량 0대가 확인됐다는 뜻이 아니다. 미러에 없는 도시는 0으로 생성하지 않는다. 지역별 `newest`는 마지막 신규 발견 기록이며 모든 차량의 마지막 운행 시각이 아니다.

## 직접 자동 수집 제한과 무료 대안

2026-10-29 원본 HTML과 공개 정적 자산은 HTTP 200으로 읽혔다. 공개 클라이언트에 실제 등장하는 `/data/tesla-robotaxi-fleet.json`, `/data/us-fleet-estimates.json`은 HTTP 403과 자동 접근 불허 메시지를 반환했다. 앞선 조사에서 `/v1/api/texas-dmv`도 동일한 제한을 확인했다.

헤더·쿠키 위장, 프록시·다른 호스트·브라우저 내부 요청을 통한 우회는 하지 않는다. 원본 직접 수집 성공으로 표시하지 않으며 자동 수집은 이미 공개된 Pioneerlands 집계 경로만 사용한다. 그 경로도 접근 제한이나 구조 변경이 생기면 중단하고 마지막 정상 수치·수치 기준일을 보존한다. HTTP 401/403/404는 재시도하지 않고 그 밖의 실패도 요청당 최대 두 번으로 제한한다.

무료 대안은 현재 공개 미러, 기존 허용된 Texas 등록 집계 출처, 출처 링크가 있는 수동 입력이다. 등록 집계는 도시 명부의 대체값으로 섞지 않는다. 원본과 같은 필터의 직접 자동 갱신이 꼭 필요하면 운영자에게 공개 집계 API의 이용 조건을 확인해야 하며, 현재는 새 키·유료 서비스·권한 확대가 필요하지 않다.

## 출처 표기와 보존

- 표기: `Robotaxi Tracker · Pioneerlands 공개 집계 미러`. 링크는 실제 수집 경로를 가리키고 설명에 원자료 Robotaxi Tracker / Ethan McKanna를 명시한다.
- [About](https://robotaxitracker.com/about)에 원자료 서비스의 독립성과 운영자 연락 경로가 있다. [Terms](https://robotaxitracker.com/terms)는 2026-08-23 개정본이며 공개 API 범위 밖의 자동 수집을 제한한다. 데이터 전체나 원본 UI 자산에 대한 일반적인 공개 재사용 라이선스는 확인하지 못했다.
- 다른 사이트의 로고·사진·아이콘·문구·코드를 복사하지 않는다. 집계 구조와 읽기 쉬운 정보 배치를 참고하고 ATLAS의 자체 UI로 표현한다.
- 새 미러 확인만으로 같은 숫자의 `asOf`, 최초 수집일, 관측 이력을 새 날짜로 바꾸지 않는다. 작업 확인 시각, 미러 실행 시각, 실제 신규 발견 시각을 분리한다.
- 수치 변경은 기존 ingest의 정정·중복 방지 규칙을 그대로 거친다. 미수집 날짜 보간이나 과거 수치 생성은 하지 않는다. 과거 모델별 선의 별도 검증은 [MODEL-HISTORY-SOURCE-AUDIT.md](MODEL-HISTORY-SOURCE-AUDIT.md)를 따른다.
