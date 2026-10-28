# 실행 · 배포 · 운영

## 내 컴퓨터에서 보기

Node.js 24 LTS와 pnpm 11.25 이상을 권장합니다. 표준 설치가 없는 이 작업 컴퓨터에서는 Codex 제공 Node와 pnpm으로 실행했습니다.

```text
pnpm install
pnpm dev
```

콘솔의 Local 주소(기본 http://127.0.0.1:5173/)를 엽니다. 실제 데이터 기본, `?demo=1`은 가상 데이터입니다. npm을 사용할 때는 `npm install`, `npm run dev`도 가능합니다. CI는 pnpm-lock.yaml을 사용합니다.

```text
pnpm test
pnpm build
pnpm preview
pnpm collect
node scripts/collect.mjs --simulate-failure --dry-run
pnpm collect:statistics
pnpm collect:monitoring
pnpm scenarios
node scripts/collect-statistics.mjs --force
node scripts/collect-statistics.mjs --simulate-failure --force --dry-run
```

지도 파일은 이미 포함되어 있습니다. 지도 경계를 재생성하려면 `pnpm geo`. Natural Earth 국가와 U.S. Census 주 경계를 world-atlas/us-atlas 패키지에서 GeoJSON으로 변환했습니다. 외부 지도 타일·키가 필요 없습니다. Google Fonts가 차단되면 시스템 한국어 글꼴로 표시합니다.

## GitHub Pages와 예약 수집

저장소 → Settings → Pages → Build and deployment → Source: GitHub Actions. 기본 브랜치 main에 `.github/workflows/update-deploy.yml`이 있으면 push/수동/예약으로 수집과 배포가 실행됩니다. 무료 공개 저장소와 무료 GitHub 호스팅 실행기만 사용합니다. 유료 실행기·API는 설정하지 않았습니다.

예약은 `timezone: Asia/Seoul`의 매일 오전 8시입니다. 08:17·09:17·10:17·11:17에는 보완 점검을 실행합니다. 공개 사이트에 오늘 오전 8시 이후 성공·부분 성공한 수집 결과가 이미 배포됐다면 중복 수집을 생략합니다. 실패·누락·배포 실패로 공개 데이터가 오래됐으면 다시 수집·배포합니다. 단순 데이터 커밋만으로 완료를 판단하지 않습니다. 수동 실행과 코드 push는 항상 갱신합니다.

개인 컴퓨터와 관계없이 GitHub 서버에서 실행됩니다. 예약 파일의 존재, GitHub 워크플로 활성 상태, 실제 실행 성공은 별개이므로 Actions 기록을 확인하세요. GitHub의 시간대·예약 동작: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

GitHub는 정각 시작·완료를 보장하지 않습니다. 특히 매시 정각은 지연되거나 큐 작업이 누락될 수 있습니다. 공개 저장소는 60일간 활동이 없으면 예약이 비활성화될 수 있습니다. 이 작업은 매일 스냅샷 커밋을 남기지만 플랫폼의 예약 제한과 장애는 통제하지 못합니다.

Actions → Collect data and deploy Pages → Run workflow → main → Run workflow로 수동 실행합니다. 인구 통계를 즉시 재확인하려면 `refresh_statistics`를 체크합니다. 실패한 실행의 우측 상단 Re-run jobs로 재시도합니다. 차량 출처는 최대 3회, 통계 출처는 최대 2회이며 401·403·404는 재시도하지 않습니다. 같은 한국 날짜의 실행·스냅샷은 중복 추가하지 않습니다. 새 소식은 고유 ID로 중복을 막습니다.

Census는 최근 확인 후 7일이 지났을 때 새 공식 CSV를 확인합니다. 런던·서울 인구와 TfL·서울 교통은 수동 검토 자료이며 자동 수치 추출은 미연결입니다. 통계·모델·사용자 가정은 차량 배치 이력과 별도 관리합니다. 최신 기본값과 근거는 [모델 2.0](MODEL-2.md)에 있습니다. 예전 브라우저 v1 설정은 보존하되 v2 기본값을 가리지 않습니다.

차량 수: Pioneerlands 도시 명부는 오전 8시 전체 수집에서 확인합니다. TxDMV 공개 JSON 등록부와 FSD Database의 동일 원본 민간 재집계는 별도 `Refresh Texas registrations` 워크플로가 매시간 23분에 추가 점검합니다. 이 작업은 등록 집계만 수집하며 51개 관할 문서·뉴스를 반복 수집하지 않고, 도시·뉴스의 기준일과 전체 수집 시각도 바꾸지 않습니다. 원본 장애 시 이전 값과 원래 기준일을 보존합니다. 무료 공개 GitHub 실행기와 공개 자료만 사용합니다.

공식 주 등록 수치는 첫 화면의 별도 요약에 표시합니다. 도시 명부와 주 등록부를 합산하지 않습니다. 모델·기준일·범위가 다르면 별도 표시합니다. 숫자가 같으면 원래 수치 기준일을 유지하고 점검 시각만 갱신합니다. 브라우저는 페이지가 다시 활성화될 때와 표시 중 5분 간격으로 게시 JSON을 다시 읽습니다. ‘게시 데이터 새로고침’은 마지막 배포 결과를 읽으며 공식 원본의 즉시 수집 버튼은 아닙니다.

미국 51개 관할 공식 문서, 알려진 해외 문서 3개와 공개 검색 RSS 3개를 별도로 점검합니다. 문서 해시 변경은 허가·운영 사실의 자동 확정이 아닙니다. 차량 수 추출기는 텍사스에만 연결됐습니다. 나머지 50곳은 문서 감시와 수치 추출 미연결을 구분합니다. 재시도는 최대 2회·요청당 10초, 문서는 최대 12MB입니다. 자세한 범위와 실패 분류는 [점검 범위](COVERAGE.md)를 확인하세요. RSS 후보는 원문 검토 전 수치나 운행 상태에 반영하지 않습니다.

수집 일부/전체 실패도 마지막 정상 자료를 배포하고 출처별 실패를 표시합니다. 따라서 GitHub 실행이 녹색이어도 모든 출처가 성공했다는 뜻은 아닙니다. 실행 Summary와 사이트 ‘출처 · 방법론’의 각 출처 상태를 함께 봅니다. 스키마·검증 오류는 배포 전에 실패하게 되어 있습니다.

워크플로가 GITHUB_TOKEN으로 데이터 커밋을 저장해도 추가 push 워크플로가 재귀 실행되지 않습니다. 같은 실행에서 갱신 데이터로 사이트를 빌드·배포합니다. 작업은 concurrency로 직렬화됩니다. 데이터 저장 중에 원격 main이 변경되어 push가 거부되면 자동으로 덮어쓰지 않고 실패합니다. 최신 main으로 수동 재실행하세요.

브라우저에는 비밀키가 없습니다. 수동 실행·배포에는 기본 GITHUB_TOKEN의 contents:write, pages:write, id-token:write 권한이 필요합니다. 별도 저장소 Secret을 등록할 필요는 없습니다.

## 새 지역 추가

atlas.json의 cities에 country/countryName/region/regionName/coordinates를 추가합니다. 미국 외 행정구역도 같은 구조를 쓰며, 세부 경계는 해당 국가 GeoJSON을 지도 sources/layers에 추가합니다. 현재는 전 세계 국가 경계와 미국 주 경계를 제공하고, 한국·영국의 하위 경계는 아직 포함하지 않았습니다. 도시·지역 필터는 경계 파일 없이도 동작합니다.

## 작업 후 확인할 것

1. 도시 명부의 관측 기간·도시 간 이동 중복·실제 배치 및 상업운행 대수 확보. 명부를 영업 대수로 승격하지 않기.
2. Tesla 자동 요청 403, 미연결 주의 수치 자료, 신규 RSS 원문 검토. 공식 신규 계획은 검토된 지역 목록과 일치할 때 지도에 추가하며 모르는 지역명은 검토 대기.
3. 필요하면 근거를 확인한 자료를 manual.csv에 추가. 이 자료는 잠금으로 보존.
4. 최초 예약 시각 이후 Actions가 schedule 이벤트로 실행됐는지 확인. 수동 실행 성공만으로 정기 예약 실행 실적을 주장하지 않기.

## 2026-10-28 예약 중단 복구

10월 24·25일 예약은 성공했지만 26·27일은 수집 전 테스트에서 중단됐다. 테스트가 계속 변하는 실제 atlas.json의 실행 기록과 고정된 10월 24일을 함께 사용하고, 배열 마지막 항목을 테스트 대상 실행으로 간주한 것이 원인이다. 현재는 단위 테스트 입력을 고정된 예제로 분리하고 한국 날짜의 실행 ID로 결과를 검증한다. 이후 날짜의 기록이 있어도 같은 날 재실행·실패 보존 검증이 동작하는 회귀 테스트를 추가했다. 예약을 늦게 시작하거나 실패해도 자동 보완하도록 위 점검 시간을 추가했다. 데이터 원본 기준일은 갱신 성공 표시를 위해 변경하지 않는다.
