import {readFile,writeFile} from 'node:fs/promises';
import {blankMarket,calculateMarket,productivityFromTime,MODEL_VERSION} from '../src/market.mjs';
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const stats=await read('public/data/statistics.json'),facts=await read('data/demand-evidence.json'),nhts=await read('data/nhts-2022-proxy.json');
const defaults={};
const nhtsBands=nhts.bands??nhts.groups;
if(!nhtsBands)throw Error('NHTS 근거 구조 검토 필요');
// Input facts retain their original periods. Derived defaults are a versioned model,
// not new vehicle observations and not an update to source publication dates.
for(const profile of stats.profiles){
  const city=profile.city,h=facts.households.find(h=>h.city===city);let taxi,privateTrips,paid,unit='person_trips',basisDate,scopeId,scope,occupancy='1.3',evidence=[];
  if(h){
    const metro=stats.populations.find(p=>p.scopeId===profile.metroScopeId);
    const band=metro.value<3000000?'4':'5';const raw=nhtsBands.find(x=>x.msaSizeCodes?.includes(Number(band)));const b=raw&&{taxiTncPersonTripsPerHouseholdPerDay:raw.taxiAndRidehail.personTripsPerHouseholdPerDay,privateVehiclePersonTripsPerHouseholdPerDay:raw.privateCarVanSuvPickup.personTripsPerHouseholdPerDay,taxiTncMeanMinutes:raw.taxiAndRidehail.averageTripMinutes,taxiTncRecords:raw.taxiAndRidehail.unweightedTripRecords};
    if(!b)throw Error('도시 규모별 NHTS 대체 자료 없음: '+city);
    taxi=h.value*b.taxiTncPersonTripsPerHouseholdPerDay;privateTrips=h.value*b.privateVehiclePersonTripsPerHouseholdPerDay;paid=b.taxiTncMeanMinutes;
    basisDate='2024-12-31';scopeId=`us:resident-travel:${city}`;scope=`도시 거주 가구의 이동 수요 · NHTS MSA 규모 ${band==='4'?'100만–300만 미만':'300만 이상'} 평균 적용`;
    evidence=[{kind:'official',label:'공식 통계',value:`${h.value.toLocaleString('ko-KR')}가구 · ${facts.householdsPeriod}`,url:`https://www.census.gov/quickfacts/fact/table/${h.slug}/HSD410224`,note:'행정시 거주 가구. 인구를 임의 고정 비율로 바꾸지 않음. 가구 수는 공식 페이지 수동 검토 값이며 API 자동 수집 미연결.'},{kind:'proxy',label:'대체 자료',value:`택시·호출차 ${b.taxiTncPersonTripsPerHouseholdPerDay.toFixed(5)}, 개인차 ${b.privateVehiclePersonTripsPerHouseholdPerDay.toFixed(3)} 사람 이동/가구·일`,url:'https://nhts.ornl.gov/downloads',note:`NHTS 2022 전국 동일 MSA 규모의 가중 평균. 현지 도시 관측값 아님. 택시·TNC 표본 ${b.taxiTncRecords}건으로 불확실성이 크고 2022년 팬데믹 영향·관광객 차이·최신 수요 증가 미반영.`},{kind:'proxy',label:'대체 운행시간',value:`${paid.toFixed(2)}분/건`,url:'https://nhts.ornl.gov/media/2022/doc/codebook.pdf',note:'같은 MSA 규모 택시/TNC 사람 이동시간을 유료 운행시간의 대체자료로 사용. 결측 음수 제외. 픽업·대기 포함 여부의 조사상 한계 존재.'}];
  }else if(city==='london'){
    const f=facts.london;taxi=f.taxiPersonTripsPerDay;privateTrips=f.privatePersonTripsPerDay;paid=30;basisDate=f.asOf;scopeId='uk:transport:tfl-london-touching-trips';scope=f.scope;
    evidence=[{kind:'official',label:'공식 이동 통계',value:'택시/PHV 약 400,000 · 개인차 약 9,100,000 사람 이동/일',url:f.sourceUrl,note:f.note},{kind:'assumption',label:'운행시간 분석 가정',value:'유료 운행 30분/건',url:null,note:'같은 지역·수단의 평균 운행시간을 확보하지 못해 설명 가능한 시간 예산 가정으로 설정. 관측 통계 아님.'}];
  }else if(city==='seoul'){
    const f=facts.seoul;taxi=f.allMotorisedPersonTripsPerDay*f.taxiSharePercent/100;privateTrips=f.allMotorisedPersonTripsPerDay*f.privateSharePercent/100;paid=f.paidMinutesProxy;basisDate=f.asOf;scopeId='kr:transport:seoul-od-2023';scope=f.scope;
    evidence=[{kind:'official',label:'공식 이동 통계',value:`31,945,000 사람 이동/평일 × 택시 2.8% / 승용차 27.8%`,url:f.sourceUrl,note:f.note},{kind:'proxy',label:'대체 운행시간',value:'18.9분/건 · 2026-01-31 등록 택시 실적',url:f.paidMinutesSourceUrl,note:'2023 O/D 수요와 연도·차량 모집단이 다름. 로보택시 생산성 실측치가 아닌 시간 대체자료.'}];
  }else continue;
  const budget={hours:'20',paidMinutes:String(paid),pickupMinutes:'6',emptyMinutes:'8',chargeMinutes:'120',cleanMinutes:'45',maintenanceMinutes:'30',otherDowntimeMinutes:'180'};
  const marketP=productivityFromTime(budget).value,teslaBudget={...budget},teslaP=productivityFromTime(teslaBudget).value;
  const base={...blankMarket(city,scopeId),customScope:scope,referenceDate:basisDate,unit,occupancy,replacement:String(taxi),growth:'2',sourceIncludesExternal:true,sourceDemandId:`default-${city}`,scenarios:[20,50,80].map((conversion,i)=>({conversion:String(conversion),teslaShare:String([10,25,40][i]),marketProductivity:String(marketP),teslaProductivity:String(teslaP),inducedDemand:String([0,10,25][i])}))};
  const future={...base,horizon:'2030',market:'expanded',additional:String(privateTrips*.05),additionalDistinct:true};
  for(const input of [base,future]){const r=calculateMarket(input);if(!r.coherent)throw Error(city+': '+JSON.stringify(r));}
  defaults[city]={current:base,future,evidence,scope,sourceBasis:basisDate,taxiPersonTrips:taxi,privatePersonTrips:privateTrips,marketBudget:budget,teslaBudget,confidence:h?'공식 통계 + MSA 규모 대체 추정':'공식 지역 이동 통계 + 분석 가정',limitations:'시장 전체와 Tesla는 수요 점유율·각 생산성으로 별도 계산. 명부 차량과 지리·정의·시점이 달라 현재 비율·추가 대수는 계산하지 않음.'};
}
const output={version:MODEL_VERSION,reviewedOn:facts.reviewedOn,defaults,assumptions:{conversion:[20,50,80],teslaDemandShare:[10,25,40],occupancy:1.3,futurePrivateEligiblePercent:5,annualDemandGrowth:2,rationale:['전환율 20/50/80%: 기존 택시·호출차 수요에 대한 낮음/중간/높음의 분석 범위이며 회사 전망이 아님.','Tesla 수요 점유율 10/25/40%: 복수 사업자가 공존하는 경쟁 구도를 보는 분석 가정.','평균 동승 1.3명: 1인·일행 탑승의 변환 가정. 관측 평균 아님.','2030 확장은 기존 택시·호출차와 겹치지 않는 개인차 이동 중 5%를 추가 대상으로 설정.','연간 수요 성장 2%는 원자료 기준연도부터 적용하는 가정이며 인구 예측을 다시 곱하지 않음.','보유차 20시간 계획 중 충전120·청소45·정비30·기타비가동180분 제외. 건당 픽업6·추가 공차8분. 시장/Tesla에 처음에는 같은 시간 가정을 적용하고 각각 수정 가능.','피크 대기시간·교통 혼잡·수요의 시간대 집중은 반영하지 않았으며 최소 서비스 차량이나 배치 계획을 의미하지 않음.']}};
output.assumptions.inducedDemand=[0,10,25];output.assumptions.rationale.push('순수 유발 신규수요 0/10/25%: 저렴한 요금 때문에 기존 이동의 대체가 아닌 추가 운행이 생긴다는 분석 가정. 가격·탄력성 실측 근거는 미확보. 기존 전환 운행에 한 번만 적용하며 개인차 전환·연 2% 기초수요 성장에 이미 포함된 이동을 다시 세지 않는다고 가정.');
await writeFile('public/data/scenarios.json',JSON.stringify(output,null,2)+'\n');console.log('기본 시나리오 생성: '+Object.keys(defaults).length+'개 도시 · 현재/2030 · '+MODEL_VERSION);
