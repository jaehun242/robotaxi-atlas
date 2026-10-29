# ROBOTAXI ATLAS

미국 50개 주와 Washington, D.C.에서 출처·차종·집계 기준을 구분하는 테슬라 로보택시 관측 지도. 한국어 React + TypeScript, MapLibre GL JS, Apache ECharts. GitHub Pages + 매일 한국시간 08:00 GitHub Actions.

- 공개 사이트: https://jaehun242.github.io/robotaxi-atlas/
- 가상 데이터 기능 확인: https://jaehun242.github.io/robotaxi-atlas/?demo=1
- 텍사스 공식 주 등록부와 6개 도시·Bay Area 광역권의 비공식 명부를 실제 수집합니다. 등록·명부·배치·영업은 서로 합산하지 않습니다. 미검증 343/312/108은 합계에서 제외합니다.
- Tesla 공식 서비스 안내를 원문 검토해 초기화했습니다. 서버 자동 접근은 차단될 수 있으며, 사이트에 출처별 수집 결과를 표시합니다.

```text
pnpm install
pnpm dev
pnpm test
pnpm collect
pnpm build
```

[실행·배포·자동 갱신](docs/OPERATIONS.md) · [데이터 입력·출처·검증](docs/DATA.md)

[미국 11개 관측 도시의 시나리오·계산 근거](docs/MODEL-3.md): 공식 통계·대체 자료·분석 가정을 분리하고 현재/2030의 전체 시장·Tesla 결과를 첫 접속부터 표시합니다. [미국 51개 관할과 도시별 실제 수집 범위](docs/COVERAGE.md)를 공개합니다.

지도 경계와 앱은 정적 파일입니다. API 키·유료 서비스가 없어도 마지막 정상 데이터로 동작합니다. Tesla와 관계없는 독립 프로젝트입니다.

공식 차종별 그래프의 날짜 범위는6월9일부터이며, 확보한 공식 모델 스냅샷은10월23일부터입니다. 미확보 기간은 공백으로 두고 민간 과거 총계와 구분합니다. [과거 자료 조사 결과](docs/REGISTRATION-HISTORY.md). 해외 신규 수집은 일시 중지하고 기존 원본·확인 날짜는 보존합니다.
