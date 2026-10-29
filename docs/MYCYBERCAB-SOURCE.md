# MyCybercab 보조 도시 참고값

2026-10-29의 후속 사용자 요청에 따라 기본 도시 출처를 Robotaxi Tracker 공개 명부로 변경했다. MyCybercab은 기본 숫자를 대체하지 않으며, 도시 분석의 `차량 수 조사·근거` 안에서 접힌 **다른 출처 참고**로만 제공한다.

MyCybercab Austin 카드의 `Official fleet claim` 초기 표기는 **573+**, 원문 기준일은 **2026-10-27**(시각·시간대 미공개)이다. 원문이 official이라고 표현해도 당사 공식 확인으로 승격하지 않는다. `Dataset.cityFleetClaims`의 `basis=reported_fleet`, `verification=unofficial`로 보존하며 원래 관측값·확인 날짜·정정 이력을 유지한다.

도시 기본 화면은 Robotaxi Tracker / Pioneerlands 명부의 Austin Cybercab 229, Model Y 236을 사용한다. 텍사스 공식 등록 Cybercab 573은 주 전체 등록 수치로 별도 표시한다. 세 정의를 합산하거나 서로의 역사·증감·시장 비율로 사용하지 않는다.

`alternateCityClaim()`은 다른 출처 참고값의 검증·필터·날짜 보존을 담당한다. `preferredCityClaim()`은 현재 기본 출처 정책상 null을 반환하여 기존 지도·카드·시장·CSV의 명부 관측값을 덮어쓰지 않는다.

수집기는 원래 Austin 카드의 claim 항목만 읽는다. 등록부 숫자나 unique sightings로 빈 claim을 채우지 않는다. 요청은 제한적으로 재시도하고 403은 재시도하지 않는다. 수집 실패 시 마지막 정상값과 원래 날짜를 유지한다.
