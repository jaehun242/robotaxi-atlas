import {kstDay} from './domain.mjs';
export const MODEL_VERSION='2.0.0';
export const SCENARIO_NAMES=['보수적','기준','공격적'];
export const numeric=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
export function blankMarket(city,scopeId){return {city,scopeId,customScope:'',market:'replacement',horizon:'current',referenceDate:'',unit:'vehicle_trips',occupancy:'',replacement:'',additional:'',additionalDistinct:false,externalEnabled:false,external:'',externalDistinct:false,growth:'',mix:'',sourceDemandId:null,sourceIncludesExternal:false,scenarios:SCENARIO_NAMES.map(()=>({conversion:'',teslaShare:'',marketProductivity:'',teslaProductivity:''}))};}
// Explicitly selected illustration; never a factual city forecast or a silent default.
export function illustration(input){return {...input,referenceDate:new Date().toISOString().slice(0,10),replacement:'100000',unit:'vehicle_trips',occupancy:'',market:'replacement',horizon:'current',growth:'',sourceDemandId:null,sourceIncludesExternal:false,scenarios:[10,30,60].map((c,i)=>({conversion:String(c),teslaShare:String([10,20,30][i]),marketProductivity:'25',teslaProductivity:'30'}))};}
export function productivityFromTime(t){
  const errors=[];const v=Object.fromEntries(['hours','paidMinutes','pickupMinutes','emptyMinutes','chargeMinutes','cleanMinutes','maintenanceMinutes','otherDowntimeMinutes'].map(k=>[k,numeric(t[k])]));
  if(Object.values(v).some(x=>x===null))errors.push('시간 항목을 모두 입력해 주세요. 비해당 항목은 0을 입력합니다.');
  if(v.hours!==null&&(v.hours<=0||v.hours>24))errors.push('하루 운영 시간은 0 초과 24 이하입니다.');
  if(Object.entries(v).some(([k,n])=>k!=='hours'&&n!==null&&n<0))errors.push('시간은 음수일 수 없습니다.');
  if(v.paidMinutes!==null&&v.paidMinutes<=0)errors.push('유료 운행시간은 0보다 커야 합니다.');
  const downtime=v.chargeMinutes+v.cleanMinutes+v.maintenanceMinutes+v.otherDowntimeMinutes;
  const available=v.hours*60-downtime,cycle=v.paidMinutes+v.pickupMinutes+v.emptyMinutes;
  if(!errors.length&&available<0)errors.push('충전·청소·정비·비가동 시간이 운영 시간을 초과합니다.');
  return {value:errors.length?null:available/cycle,availableMinutes:errors.length?null:available,cycleMinutes:errors.length?null:cycle,errors};
}
export function calculateMarket(input){
  const errors=[],warnings=[];const replacement=numeric(input.replacement),additional=input.market==='expanded'?numeric(input.additional):0,external=input.externalEnabled?numeric(input.external):0;
  if(!input.scopeId||input.scopeId.endsWith(':service')&&!input.customScope.trim())errors.push('서비스 범위를 지정해 주세요.');
  if(replacement===null||replacement<0)errors.push('택시·호출차 대체 수요를 0 이상으로 입력해 주세요.');
  if(additional===null||additional<0)errors.push('확장 시장의 추가 수요를 0 이상으로 입력해 주세요.');
  if(additional>0&&!input.additionalDistinct)errors.push('개인차 대체 수요가 기존 택시·호출차 수요와 중복되지 않는지 확인해 주세요.');
  if(external===null||external<0)errors.push('별도 외부 수요를 0 이상으로 입력해 주세요.');
  if(external>0&&!input.externalDistinct)errors.push('외부 수요가 기존 수요에 포함되지 않았는지 확인해 주세요.');
  if(external>0&&input.sourceIncludesExternal)errors.push('선택한 공식 수요에 통근·방문 수요가 이미 포함됩니다. 외부 수요를 다시 더할 수 없습니다.');
  const validDate=/^\d{4}-\d\d-\d\d$/.test(input.referenceDate)&&Number.isFinite(Date.parse(input.referenceDate));
  if(!validDate||new Date(input.referenceDate).toISOString().slice(0,10)!==input.referenceDate)errors.push('유효한 수요 기준일을 입력해 주세요.');
  const occupancy=input.unit==='person_trips'?numeric(input.occupancy):1;
  if(occupancy===null||occupancy<1)errors.push('사람 이동을 차량 운행으로 바꾸는 평균 동승 인원을 1 이상으로 입력해 주세요.');
  const baseYear=Number(input.referenceDate.slice(0,4)),growth=numeric(input.growth);
  if(input.horizon==='2030'&&(growth===null||growth< -100||baseYear>2030))errors.push('2030 시나리오에는 연간 수요 증감률과 2030 이하 기준연도가 필요합니다.');
  const factor=input.horizon==='2030'?Math.pow(1+growth/100,2030-baseYear):1;
  if(!Number.isFinite(factor))errors.push('수요 증가 가정이 계산 가능한 범위를 초과합니다.');
  const target=errors.length?null:(replacement+additional+external)/occupancy*factor;
  const mix=numeric(input.mix);if(input.mix.trim()&&(mix===null||mix<0||mix>100))errors.push('Cybercab 비중은 0~100%입니다.');
  const results=SCENARIO_NAMES.map((name,i)=>{
    const s=input.scenarios[i],localErrors=[];if(!s)return {name,errors:['시나리오 입력 없음'],paidTrips:null,teslaPaidTrips:null,marketFleet:null,teslaFleet:null,cybercab:null,modelY:null};
    const conversion=numeric(s.conversion),share=numeric(s.teslaShare),marketP=numeric(s.marketProductivity),teslaP=numeric(s.teslaProductivity),induced=numeric(s.inducedDemand??'0');
    if(conversion===null||conversion<0||conversion>100)localErrors.push('로보택시 전환율 0~100% 필요');
    if(share===null||share<0||share>100)localErrors.push('Tesla 수요 점유율 0~100% 필요');
    if(marketP===null||marketP<=0||teslaP===null||teslaP<=0)localErrors.push('전체 시장과 Tesla의 보유 차량 생산성을 각각 0 초과로 입력');
    if(induced===null||induced<0||induced>100)localErrors.push('추가 유발 수요는 기존 전환 운행 대비 0~100%로 입력');
    const basePaid=target===null||localErrors.length?null:target*conversion/100;
    const inducedPaid=basePaid===null?null:basePaid*induced/100;
    const paid=basePaid===null?null:basePaid+inducedPaid,teslaPaid=paid===null?null:paid*share/100;
    const marketFleet=paid===null?null:Math.ceil(paid/marketP),teslaFleet=teslaPaid===null?null:Math.ceil(teslaPaid/teslaP);
    if(marketFleet!==null&&(!Number.isSafeInteger(marketFleet)||!Number.isSafeInteger(teslaFleet)))localErrors.push('필요 차량 수가 안전하게 계산 가능한 정수 범위를 초과합니다.');
    if(teslaFleet!==null&&teslaFleet>marketFleet)localErrors.push('Tesla 차량 수가 전체 시장보다 큽니다. 점유율·평균 생산성 가정이 모순됩니다.');
    if(paid>0&&share<100&&teslaFleet===marketFleet)localErrors.push('Tesla 이외 수요를 처리할 차량이 남지 않습니다. 반올림·생산성 가정을 확인해 주세요.');
    if(paid>0&&share===100&&marketP!==teslaP)localErrors.push('Tesla 점유율 100%이면 전체 시장과 Tesla 생산성이 같아야 합니다.');
    const cybercab=teslaFleet!==null&&mix!==null?Math.round(teslaFleet*mix/100):null;
    return {name,paidTrips:paid,basePaidTrips:basePaid,inducedPaidTrips:inducedPaid,teslaPaidTrips:teslaPaid,marketFleet,teslaFleet,cybercab,modelY:cybercab===null?null:teslaFleet-cybercab,errors:localErrors};
  });
  if(results.every(r=>r.marketFleet!==null&&r.teslaFleet!==null)){
    for(let i=1;i<3;i++){
      if(results[i].paidTrips<results[i-1].paidTrips)warnings.push(`${SCENARIO_NAMES[i-1]} → ${SCENARIO_NAMES[i]} 유료 운행 수요가 감소합니다. 수요·보급 수준을 기준으로 정의한 명칭과 가정을 확인해 주세요.`);
      if(numeric(input.scenarios[i].conversion)<numeric(input.scenarios[i-1].conversion)||numeric(input.scenarios[i].teslaShare)<numeric(input.scenarios[i-1].teslaShare))warnings.push('보수적 → 기준 → 공격적 전환율·Tesla 점유율 순서가 일치하지 않습니다.');
    }
  }
  return {results,errors,warnings:[...new Set(warnings)],coherent:!errors.length&&!warnings.length&&results.every(r=>!r.errors.length),targetVehicleTrips:target,growthFactor:errors.length?null:factor};
}
export function compareFleet(rows,input,calculation){
  const unavailable=reason=>({allowed:false,count:rows.length?rows.reduce((n,o)=>n+o.count,0):null,reason,ratios:[null,null,null],additional:[null,null,null]});
  if(!rows.length)return unavailable('현재 검증된 차량 수가 없습니다.');
  if(input.horizon!=='current')return unavailable('2030 수요와 현재 재고는 기간이 달라 비율·추가 차량 수를 계산하지 않습니다.');
  if(!calculation.coherent)return unavailable('필수 입력 또는 시나리오 일관성 검증을 먼저 완료해 주세요.');
  if(new Set(rows.map(o=>o.model)).size!==2||rows.some(o=>o.coverageComplete!==true))return unavailable('Cybercab·Model Y 전체 범위가 확인된 차량 수가 필요합니다.');
  if(rows.some(o=>o.scopeId!==input.scopeId))return unavailable('현재 차량과 수요의 지역 범위가 다르거나 확인되지 않았습니다.');
  if(rows.some(o=>o.basis!=='deployed'||o.vehicleDefinition!=='tesla_owned_fleet'))return unavailable('현재 배치 차량과 추정 보유 차량의 정의가 일치하지 않습니다.');
  if(rows.some(o=>!o.asOf||kstDay(o.asOf)!==input.referenceDate))return unavailable('현재 차량과 수요 가정의 기준일이 다릅니다.');
  const count=rows.reduce((n,o)=>n+o.count,0);
  return {allowed:true,count,reason:'동일 지역·기준일·Tesla 보유 차량 정의 확인',ratios:calculation.results.map(r=>r.teslaFleet>0?count/r.teslaFleet:null),additional:calculation.results.map(r=>Math.max(0,r.teslaFleet-count))};
}
export function uniquePopulation(records){
  if(new Set(records.map(r=>r.kind)).size>1)throw Error('도시 인구와 광역권 인구를 합산할 수 없습니다.');
  const unique=new Map(records.map(r=>[r.scopeId,r]));
  if(new Set([...unique.values()].map(r=>r.asOf)).size>1)throw Error('서로 다른 기준일 인구를 합산하지 않습니다.');
  return [...unique.values()].reduce((n,r)=>n+r.value,0);
}
