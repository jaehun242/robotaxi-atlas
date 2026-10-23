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
node scripts/collect-statistics.mjs --force
node scripts/collect-statistics.mjs --simulate-failure --force --dry-run
```

지도 파일은 이미 포함되어 있습니다. 지도 경계를 재생성하려면 `pnpm geo`. Natural Earth 국가와 U.S. Census 주 경계를 world-atlas/us-atlas 패키지에서 GeoJSON으로 변환했습니다. 외부 지도 타일·키가 필요 없습니다. Google Fonts가 차단되면 시스템 한국어 글꼴로 표시합니다.

## GitHub Pages와 예약 수집

저장소 → Settings → Pages → Build and deployment → Source: GitHub Actions. 기본 브랜치 main에 `.github/workflows/update-deploy.yml`이 있으면 push/수동/예약으로 수집과 배포가 실행됩니다. 무료 공개 저장소와 무료 GitHub 호스팅 실행기만 사용합니다. 유료 실행기·API는 설정하지 않았습니다.

예약은 `0 23 * * *` UTC, 한국시간 매일 오전 8시입니다. 개인 컴퓨터와 관계없이 GitHub 서버에서 실행됩니다. 예약 파일의 존재, GitHub 워크플로 활성 상태, 실제 실행 성공은 별개이므로 Actions 기록을 확인하세요. GitHub의 시간대·예약 동작: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

GitHub는 정각 시작·완료를 보장하지 않습니다. 특히 매시 정각은 지연되거나 큐 작업이 누락될 수 있습니다. 공개 저장소는 60일간 활동이 없으면 예약이 비활성화될 수 있습니다. 이 작업은 매일 스냅샷 커밋을 남기지만 플랫폼의 예약 제한과 장애는 통제하지 못합니다.

Actions → Collect data and deploy Pages → Run workflow → main → Run workflow로 수동 실행합니다. 인구 통계를 즉시 재확인하려면 `refresh_statistics`를 체크합니다. 실패한 실행의 우측 상단 Re-run jobs로 재시도합니다. 차량 출처는 최대 3회, 통계 출처는 최대 2회이며 401·403·404는 재시도하지 않습니다. 같은 한국 날짜의 실행·스냅샷은 중복 추가하지 않습니다. 새 소식은 고유 ID로 중복을 막습니다.

Census는 최근 확인 후 7일이 지났을 때 새 공식 CSV를 확인합니다. 런던·서울 인구와 TfL·서울 교통은 수동 검토 자료이며 자동 수치 추출은 미연결입니다. 통계·모델·사용자 가정은 차량 배치 이력과 별도 관리합니다. 자세한 기준과 수동 수정 파일은 [시장 계산 근거](MARKET.md)에 있습니다.

수집 일부/전체 실패도 마지막 정상 자료를 배포하고 출처별 실패를 표시합니다. 따라서 GitHub 실행이 녹색이어도 모든 출처가 성공했다는 뜻은 아닙니다. 실행 Summary와 사이트 ‘출처 · 방법론’의 각 출처 상태를 함께 봅니다. 스키마·검증 오류는 배포 전에 실패하게 되어 있습니다.

워크플로가 GITHUB_TOKEN으로 데이터 커밋을 저장해도 추가 push 워크플로가 재귀 실행되지 않습니다. 같은 실행에서 갱신 데이터로 사이트를 빌드·배포합니다. 작업은 concurrency로 직렬화됩니다. 데이터 저장 중에 원격 main이 변경되어 push가 거부되면 자동으로 덮어쓰지 않고 실패합니다. 최신 main으로 수동 재실행하세요.

브라우저에는 비밀키가 없습니다. 수동 실행·배포에는 기본 GITHUB_TOKEN의 contents:write, pages:write, id-token:write 권한이 필요합니다. 별도 저장소 Secret을 등록할 필요는 없습니다.

## 새 지역 추가

atlas.json의 cities에 country/countryName/region/regionName/coordinates를 추가합니다. 미국 외 행정구역도 같은 구조를 쓰며, 세부 경계는 해당 국가 GeoJSON을 지도 sources/layers에 추가합니다. 현재는 전 세계 국가 경계와 미국 주 경계를 제공하고, 한국·영국의 하위 경계는 아직 포함하지 않았습니다. 도시·지역 필터는 경계 파일 없이도 동작합니다.

## 작업 후 확인할 것

1. 실제 도시별 대수를 공개하고 정의를 명시한 출처 확보. 확보 전에는 0이나 임의 대수를 입력하지 않기.
2. Tesla 자동 요청 403과 새 분기 공시 발견, 비공식 추적 자료의 공개 API·이용 조건 확인.
3. 필요하면 근거를 확인한 자료를 manual.csv에 추가. 이 자료는 잠금으로 보존.
4. 최초 예약 시각 이후 Actions가 schedule 이벤트로 실행됐는지 확인. 수동 실행 성공만으로 정기 예약 실행 실적을 주장하지 않기.
