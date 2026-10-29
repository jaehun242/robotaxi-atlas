# MyCybercab 도시 대표값

## MyCybercab 오스틴 대표 참고값 (2026-10-29)

사용자 선택에 따라 MyCybercab Austin 카드의 Official fleet claim을 도시 대표 표시로 사용한다. 초기 값573+는 최소573이라는 원문 표기이며 수치 기준일은원문2026-10-27(시각/시간대미공개)이다. 해당 사이트의표현을당사공식확인으로승격하지 않는다. Dataset.cityFleetClaims 별도클래스(basisreported_fleet,verificationunofficial)에 저장하고원observations와등록부는보존한다. 기본명부화면에서대표표시만우선하며공식전용·다른집계기준·데모에서는제외한다.

지도/도시카드/도시별표/시장현재참고값은같은선택출처를사용한다. 커뮤니티229는보조명부로남긴다.573+와ModelY236또는Texas등록573을합산하지않으며보조명부의증감을선택출처증감처럼표시하지않는다. 도시과거명부그래프도보조자료로접었다. 시장침투율/추가필요차량계산에는별도집계주장을넣지않는다. CSV는reported_fleet/at_least/출처/원래일자를명시한다.

매일08시및매시간등록부보완workflow에서공개HTML추출을실행한다. 불변값의원문일자와최초확보시각을보존하며실패시마지막정상값을유지한다. 수동재확인: node scripts/collect-city-claims.mjs. --simulate-failure --dry-run 으로원자료를바꾸지않고실패보존검사가가능하다. 비밀키/유료서비스없음.
