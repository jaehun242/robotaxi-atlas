# 미국 관할 출처 조사: Alabama–Missouri

조사일: 2026-10-23. 대상은 25개 주와 District of Columbia, 총 26개 관할이다. 구조화한 결과는 `data/jurisdictions-a-m.json`에 저장했다.

`researchStatus: reviewed`는 특정 공식 AV/CAV 제도·사업·법률 자료를 검토했다는 의미이다. 예약 수집 성공, Tesla 운행 승인, 실제 차량 대수 추출 성공을 뜻하지 않는다. 이 조사에서 Tesla 도시·차종별 대수는 모두 `not_extracted`로 남겼다. 자료를 찾지 못했다는 이유로 0대나 미운행으로 처리하지 않는다.

## 공식 출처와 직접 접근 점검

접근 결과는 현재 컴퓨터에서 실행한 제한 HTTP 점검 결과이다. GitHub Actions의 네트워크에서는 결과가 달라질 수 있다. 각 주 출처에 한 번 요청했으며, Arkansas와 Idaho만 10초 제한 실패 후 15초 제한으로 한 번 추가 확인했다. 차단을 우회하지 않았다.

| 관할 | 공식 원문 | 직접 HTTP 점검 |
|---|---|---|
| Alabama | [SB226 Enrolled](https://alison.legislature.state.al.us/files/pdf/SearchableInstruments/2024RS/SB226-enr.pdf) | 200 PDF |
| Alaska | [DOT&PF CAV](https://dot.alaska.gov/dmio/tsmo/cav.shtml) | 200 HTML |
| Arizona | [ADOT AV 시험·운영](https://azdot.gov/mvd/services/professional-services/autonomous-vehicles-testing-and-operating-state-arizona) | 403. 공식 웹 검색·읽기 도구에서 본문 확인 |
| Arkansas | [27 CAR §115-103](https://codeofarrules.arkansas.gov/Rules/Rule?chapterID=224&levelType=section&partID=1010&sectionID=28658&subChapterID=274&subPartID=4553&titleID=27) | 제한 요청 2회 실패. 공식 웹 읽기에서 규칙 본문 확인 |
| California | [DMV 허가 명단](https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/autonomous-vehicle-testing-permit-holders/) | 200 HTML |
| Colorado | [CDOT AV 프로그램](https://www.codot.gov/programs/innovativemobility/mobility-technology/autonomous-vehicles) | 200 HTML |
| Connecticut | [CTDOT CAV 사업](https://portal.ct.gov/dot/projects/cav/projects?archived=true) | 200 HTML. 과거 사업 일정 포함 |
| Delaware | [DelDOT CAV 자문위원회](https://deldot.gov/Programs/autonomous-vehicles/index.shtml) | 200 HTML |
| District of Columbia | [DDOT AV 시험 안내](https://ddot.dc.gov/am/node/1809696) | 200 HTML |
| Florida | [FDOT CAV 프로그램](https://fdot.gov/traffic/teo-divisions.shtm/cmt/cmtp-overview) | 200 HTML |
| Georgia | [서명 법률 SB165](https://gov.georgia.gov/document/2021-signed-legislation/sb-165/download) | 200. PDF 형식·본문 실제 확인 |
| Hawaii | [HAR 19-150 규정](https://hidot.hawaii.gov/highways/files/2022/08/HAR-19-150-Autonomous-Vehicle-Regulation-FINAL-7-31-2022-STANDARD-FORMAT.pdf) | 200 PDF. 스캔본의 본문 텍스트 추출 불가 |
| Idaho | [EO 2018-01](https://itd.idaho.gov/wp-content/autonomous/Ex_Order_2018-01.pdf) | 제한 요청 2회 실패. 공식 웹 읽기에서 PDF 본문 확인 |
| Illinois | [EO 2018-13](https://www.illinois.gov/government/executive-orders/executive-order.executive-order-number-13.2018.html) | 200 HTML |
| Indiana | [INDOT CAV](https://www.in.gov/indot/emerging-mobility/connected-and-automated-vehicles/) | 200 HTML |
| Iowa | [Iowa DOT ADS 정책·절차](https://iowadot.gov/transportation-development/automated-transportation/policies-procedures) | 403. 공식 웹 읽기에서 본문 확인 |
| Kansas | [K.S.A. 8-2906](https://www.kslegislature.gov/b2025_26/laws/008_000_0000_chapter/008_029_0000_article/008_029_0006_section/008_029_0006_k/) | 200 HTML |
| Kentucky | [제정 법률 HB7](https://apps.legislature.ky.gov/RECORD/24rs/HB7.html) | 200 HTML |
| Louisiana | [DOTD CAV](https://dotd.la.gov/about/office-of-operations/intelligent-transportation-systems/its-programs-and-projects/connected-and-autonomous-vehicles/) | 403. 공식 웹 읽기에서 본문 확인 |
| Maine | [Resolve Chapter 46](https://legislature.maine.gov/legis/bills/bills_128th/chapters/RESOLVE46.asp) | 200 HTML |
| Maryland | [MDOT HAV 시험 절차](https://cav.mdot.maryland.gov/collaboration-with-industry/) | 403. 공식 웹 읽기에서 본문 확인 |
| Massachusetts | [MassDOT ADS 시험](https://www.mass.gov/guides/testing-automated-driving-systems-in-massachusetts) | 200. 실제 신청·승인 HTML 확인. 웹 읽기 도구에서는 403 |
| Michigan | [MDOT I-94 CAV FAQ](https://www.michigan.gov/mdot/about/faqs/studies/cav-corridor-project) | 200 HTML |
| Minnesota | [MnDOT CAV](https://www.dot.state.mn.us/automated/index.html) | 200 HTML |
| Mississippi | [MDOT MULTIPLAN 2050 TSMO](https://mdot.ms.gov/documents/Planning/Plan/MULTIPLAN%202050/MDOT_T05_Existing_ITS_TSMO_FINAL.pdf) | 200 PDF |
| Missouri | [MoDOT AV 정책 가이드 912](https://epg.modot.org/index.php?title=Category%3A912_Traffic_Control_Device_Considerations_for_Automated_Vehicles_%28MUTCD_Part_5%29) | 200. 실제 HTML 확인 |

California에서는 [CPUC 여객 서비스 프로그램](https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs)도 직접 HTTP 200으로 확인했다. DMV 시험·배포 허가와 CPUC 여객 서비스의 시험·유료 서비스 범주는 별개이다.

## 차단과 대안 선택

- Georgia GDOT V2X 로드맵 PDF URL은 HTTP 200이지만 246자 `Request Rejected` HTML을 반환했다. 따라서 PDF 수집 성공으로 처리하지 않고, 접근 가능한 주지사실의 서명 법률을 주 출처로 사용했다.
- Missouri CAV 실행계획 PDF URL은 HTTP 202와 빈 본문을 반환했다. 접근 가능한 공식 Engineering Policy Guide를 주 출처로 사용했다.
- MaineDOT AV 시험 신청 PDF는 웹 읽기에서 403이었다. 공식 의회의 제도 원문을 주 출처로 사용했다.
- Arkansas의 구 ARDOT `/autonomous` URL은 웹 읽기에 실패했다. 공식 규칙 포털의 신청 조항을 대신 사용했다.

법률·전략·인프라 사업·시험 신청 제도를 감시하는 것과 차량 대수 자료를 수집하는 것을 화면과 운영 보고서에서 구분해야 한다. 과거 제도 문서의 확인일은 최신 영업 현황의 기준일이 아니다.
