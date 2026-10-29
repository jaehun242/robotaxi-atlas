import {useEffect,useState} from 'react';
import type {City} from './types';
import type {Statistics,ScenarioDataset,MarketInput,MarketCalculation} from './market-types';
import {Chart} from './Chart';
import {calculateMarket} from './market.mjs';
import {approx,roundEstimate} from './estimates';

export interface CityResearchContext {
  visitor:{annualVisits:number;year:number;qualifier?:'over'|'approx';scope:string;scopeId:string;publisher:string;sourceUrl:string;publishedOn:string|null;verificationUrl?:string;note:string}|null;
  secondaryVisitor?:{annualVisits:number;year:number;scope:string};
  missingReason?:string;
  driver:{count:number|null;scope:string;sourceUrl:string;note:string};
  fareContext?:{label:string;sourceUrl:string;note:string};
  analystReading:string;
  prioritySourceUrl:string;
}
interface Props {city:City;statistics:Statistics|null;scenarios:ScenarioDataset|null;input:MarketInput;calculation:MarketCalculation;reduceMotion:boolean;context?:CityResearchContext}
const fmt=(n:number)=>n.toLocaleString('ko-KR');
const amount=(value:string)=>value.trim()===''?null:Number.isFinite(Number(value))?Number(value):null;
const names=['보수적','기준','공격적'];

export default function CityMarketContext({city,statistics,input,reduceMotion,context}:Props){
  const [perVisit,setPerVisit]=useState('1');
  const [applicable,setApplicable]=useState('50');
  useEffect(()=>{setPerVisit('1');setApplicable('50');},[city.id]);
  if(!context)return null;
  const profile=statistics?.profiles.find(p=>p.city===city.id);
  const admin=statistics?.populations.find(p=>p.scopeId===profile?.cityScopeId);
  const metro=statistics?.populations.find(p=>p.scopeId===profile?.metroScopeId);
  const v=context.visitor;
  const trips=amount(perVisit),coverage=amount(applicable);
  const valid=trips!==null&&trips>=0&&trips<=20&&coverage!==null&&coverage>=0&&coverage<=100;
  const daily=v&&valid?v.annualVisits/365*trips*coverage/100:null;
  const touristInput:MarketInput={...input,scopeId:v?.scopeId??'unknown',customScope:v?.scope??'',referenceDate:v?String(v.year)+'-12-31':'',unit:'vehicle_trips',replacement:daily===null?'':String(daily),market:'replacement',horizon:'current',externalEnabled:false,pricingMode:'manual',sourceIncludesExternal:false,scenarios:input.scenarios.map(s=>({...s,inducedDemand:'0'}))};
  const touristCalc=calculateMarket(touristInput);
  const rows=touristCalc.results.map((r,i)=>({name:names[i],market:touristCalc.coherent?r.marketFleet:null,tesla:touristCalc.coherent?r.teslaFleet:null,conversion:amount(input.scenarios[i].conversion),share:amount(input.scenarios[i].teslaShare)}));
  const option={grid:{left:46,right:14,top:35,bottom:35,containLabel:true},legend:{top:0,textStyle:{color:'#91a5bd',fontSize:11}},tooltip:{trigger:'axis'},xAxis:{type:'category',data:names,axisLabel:{color:'#a5b5c7',interval:0},axisLine:{lineStyle:{color:'#2c3c51'}}},yAxis:{type:'value',name:'보유 차량 (대)',minInterval:1,nameTextStyle:{color:'#91a5bd'},axisLabel:{color:'#91a5bd'},splitLine:{lineStyle:{color:'#223148'}}},series:[{name:'전체 시장',type:'bar',barMaxWidth:35,itemStyle:{color:'#48d9cc',borderRadius:[3,3,0,0]},data:rows.map(r=>r.market===null?null:roundEstimate(r.market))},{name:'Tesla',type:'bar',barMaxWidth:35,itemStyle:{color:'#d6bd85',borderRadius:[3,3,0,0]},data:rows.map(r=>r.tesla===null?null:roundEstimate(r.tesla))}]};
  return <section className="city-market-context" aria-label={`${city.name} 인구·방문·운전자 조사`}>
    <div className="context-cards context-key-metrics">
      <article className="panel"><span>도시 인구</span><strong>{admin?fmt(admin.value):'미확보'}<small>{admin?'명':''}</small></strong>{admin&&<a href={admin.sourceUrl} target="_blank" rel="noreferrer">{admin.asOf} 기준 ↗</a>}</article>
      <article className="panel"><span>광역권 인구</span><strong>{metro?fmt(metro.value):'미확보'}<small>{metro?'명 · 도시 포함':''}</small></strong>{metro&&<a href={metro.sourceUrl} target="_blank" rel="noreferrer">{metro.asOf} 기준 ↗</a>}</article>
      <article className="panel"><span>연간 방문량 · {v?.year??'조사 중'}</span><strong>{v?(v.qualifier==='over'?'':'약 ')+fmt(v.annualVisits/10000)+(v.qualifier==='over'?'+':''):'미확보'}<small>{v?'만 방문':''}</small></strong>{v?<a href={v.sourceUrl} target="_blank" rel="noreferrer">방문 통계 출처 ↗</a>:<small>지역 범위 대조 필요</small>}</article>
    </div>
    <details className="context-details"><summary>도시 조사·운전자·출처 <span>세부 보기</span></summary><p className="context-readout">{context.analystReading}</p><p><a href={context.prioritySourceUrl} target="_blank" rel="noreferrer">Tesla 공식 서비스 지역 ↗</a></p><p><b>택시·Uber·Lyft 운전자 총수: {context.driver.count===null?'공개 총수 미확보':fmt(context.driver.count)+'명'}</b><br/><a href={context.driver.sourceUrl} target="_blank" rel="noreferrer">운전자 규제·등록 자료 ↗</a></p>
      <p>도시 인구는 광역권에 포함되므로 더하지 않습니다. 현재 Tesla 서비스 구역은 도시 전체보다 작으며 서비스 구역 인구는 산출 근거 미확보입니다.</p>
      {admin&&<p><a href={admin.sourceUrl} target="_blank" rel="noreferrer">{admin.name} · {admin.asOf} · {admin.vintage} ↗</a></p>}
      {metro&&<p><a href={metro.sourceUrl} target="_blank" rel="noreferrer">{metro.name} · {metro.asOf} · {metro.vintage} ↗</a></p>}
      {v?<p><b>{v.scope}</b><br/>{v.note}<br/>통계 기준 {v.year}년{v.publishedOn?` · 발표 ${v.publishedOn}`:' · 발표일 미확보'} · 원문 수동 검토 자료{v.verificationUrl&&<> · <a href={v.verificationUrl} target="_blank" rel="noreferrer">교차 대조 페이지 ↗</a></>}</p>:<p>{context.missingReason}</p>}
      {context.secondaryVisitor&&<p>{context.secondaryVisitor.scope}: {fmt(context.secondaryVisitor.annualVisits)} 방문/{context.secondaryVisitor.year}년. 위 광역 방문량에 이미 포함되어 합산하지 않습니다.</p>}
      <p><b>{context.driver.scope}</b><br/>{context.driver.note} 허가 차량 수·플랫폼 등록 수·실제 동시 운전자 수는 서로 다릅니다.</p>
      {context.fareContext&&<p><a href={context.fareContext.sourceUrl} target="_blank" rel="noreferrer">{context.fareContext.label} ↗</a><br/>{context.fareContext.note}</p>}
    </details>
    {v&&<details className="visitor-scenarios panel"><summary>관광 수요만 별도로 계산 <span>{v.year}년 · {v.scope}</span></summary><div className="assumptions-body">
      <p className="assumption-note">거주 가구 수요에 합산하지 않는 독립 시나리오입니다. 방문은 고유 인원·운행 건수가 아닙니다. 방문 1건당 적격 차량 운행과 이 관광 목적지 안의 서비스 적용 비중은 분석 가정입니다.</p>
      <div className="market-input-grid"><label className="market-field"><span>방문 1건당 적격 차량 운행 · 가정</span><div><input type="number" inputMode="decimal" min="0" max="20" step="0.1" aria-label="방문 1건당 적격 차량 운행" value={perVisit} onChange={e=>setPerVisit(e.target.value)}/><em>건/방문</em></div><small>동승·체류기간을 포함해 차량 단위로 가정</small></label><label className="market-field"><span>관광 목적지 수요의 서비스 적용 비중 · 가정</span><div><input type="number" inputMode="decimal" min="0" max="100" step="1" aria-label="관광 수요 서비스 적용 비중" value={applicable} onChange={e=>setApplicable(e.target.value)}/><em>%</em></div><small>면적 비율·실측 서비스 인구가 아님</small></label></div>
      <div className="assumptions-actions">{[.5,1,2].map(n=><button key={n} className="button subtle" onClick={()=>setPerVisit(String(n))}>{n}건/방문</button>)}<button className="button subtle" onClick={()=>{setPerVisit('1');setApplicable('50');}}>관광 가정 초기화</button></div>
      <Chart title={`${city.name} · 관광 수요 독립 시나리오`} subtitle={`${v.year}년 방문량 · 서비스 적용 ${applicable}% · 방문당 ${perVisit}건 가정 · 거주 수요와 합산 안 함`} option={option} empty={rows.some(r=>r.market!==null)?undefined:'유효한 관광 가정·전환율·생산성이 필요합니다'} reduceMotion={reduceMotion}/>
      <div className="context-cards">{rows.map(r=><article className="panel" key={r.name}><span>{r.name} · 전환 {r.conversion??'—'}% / Tesla {r.share??'—'}%</span><strong>{approx(r.tesla)}<small>대 · Tesla</small></strong><small>전체 시장 {approx(r.market)}대</small></article>)}</div>
      <details className="context-details"><summary>관광 계산식·한계 보기</summary><p>연간 방문량 ÷ 365 × 방문당 적격 차량 운행 × 서비스 적용 비중 = 일평균 적격 차량 운행 ({daily===null?'계산 불가':fmt(Math.round(daily))}건). 여기에 각 로보택시 전환율을 적용한 뒤 전체 시장과 Tesla 각각의 보유 차량 생산성으로 나눕니다. Tesla에는 수요 점유율을 한 번 적용합니다.</p><p>초기 1건/방문·적용 비중 50%는 관측값이 아닌 수정 가능한 분석 기준입니다. 숙박일수를 별도로 곱하지 않고 방문 전체의 운행을 가정합니다. 관광 통계 지역은 현재 거주 가구 모델과 달라 합산하지 않습니다. {v.year}년 수요 기준을 유지하며 2030 성장·요금 탄력성·별도 유발수요는 이 독립 그래프에 적용하지 않습니다. 현재 차량 대비 비율과 추가 필요 대수도 계산하지 않습니다.</p><p>피크·계절성·공항 승차 권한·셔틀과 렌터카 대체를 별도로 검토해야 하며 최소 운행 차량 또는 실제 배치 예측이 아닙니다. 관광 가정은 화면에서만 유지됩니다.</p></details>
    </div></details>}
  </section>;
}

