# ROBOTAXI ATLAS

출처·차종·집계 기준을 구분하는 테슬라 로보택시 관측 지도. 한국어 React + TypeScript, MapLibre GL JS, Apache ECharts. GitHub Pages + 매일 한국시간 08:00 GitHub Actions.

- 공개 사이트: https://jaehun242.github.io/robotaxi-atlas/
- 가상 데이터 기능 확인: https://jaehun242.github.io/robotaxi-atlas/?demo=1
- 실제 도시별 차량 대수는 아직 검증되지 않았습니다. 미확인은 0이 아닙니다. 사용자 제공 343/312/108은 합계에서 제외합니다.
- Tesla 공식 서비스 안내를 원문 검토해 초기화했습니다. 서버 자동 접근은 차단될 수 있으며, 사이트에 출처별 수집 결과를 표시합니다.

```text
pnpm install
pnpm dev
pnpm test
pnpm collect
pnpm build
```

[실행·배포·자동 갱신](docs/OPERATIONS.md) · [데이터 입력·출처·검증](docs/DATA.md)

[도시별 시장 잠재력·인구·계산 근거](docs/MARKET.md): 전체 시장과 Tesla 수요를 분리하고, 수요·생산성 가정은 직접 입력합니다. 근거 없는 도시별 차량 전망을 기본값으로 표시하지 않습니다. 미국 Census 인구 CSV는 7일 간격으로 확인하며 런던·서울 인구·교통 참고자료의 수동 입력 여부와 기준일을 공개합니다.

지도 경계와 앱은 정적 파일입니다. API 키·유료 서비스가 없어도 마지막 정상 데이터로 동작합니다. Tesla와 관계없는 독립 프로젝트입니다.
