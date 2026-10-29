import {useState} from 'react';
import {Chart} from './Chart';
import type {Dataset,Filters} from './types';
import type {MonitoringDataset} from './monitoring-types';
import {archiveTimeline,officialTimeline,filterChangePeriod} from './registration-charts.mjs';
import {cityChangeEvents,registrationChangeEvents} from './fleet-changes.mjs';
const names:Record<string,string>={cybercab:'Cybercab',model_y:'Model Y',total:'등록 합계'};
const colors:Record<string,string>={cybercab:'#d6bd85',model_y:'#48d9cc',total:'#c4d4e5'};
const dailyKeys:Record<string,string>={cybercab:'dailyDeltaCybercab',model_y:'dailyDeltaModelY',total:'dailyDeltaTotal'};
const confirmationKeys:Record<string,string>={cybercab:'deltaCybercab',model_y:'deltaModelY',total:'deltaTotal'};
const fmt=(n:number|null)=>n===null?'미확인':n.toLocaleString('ko-KR');
const signed=(n:number)=>`${n>0?'+':''}${fmt(n)}`;
const escape=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const stamp=(s:string)=>new Date(s).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const csvCell=(s:unknown)=>`"${String(s??'').replace(/"/g,'""')}"`;
type Row={day:string;previousDay?:string|null;gapDays?:number|null;checkedAt?:string;[key:string]:string|number|boolean|null|undefined};
type Event={checkedAt:string;previousAt:string;city?:string;model:string;before:number;after:number;delta:number;gapDays:number;sourceUrl:string};
const value=(r:Row,key:string):number|null=>typeof r[key]==='number'?r[key] as number:null;
export default function FleetHistoryCharts({data,monitoring,filters,mode,reduceMotion}:{data:Dataset;monitoring:MonitoringDataset|null;filters:Filters;mode:string;reduceMotion:boolean}){
 const [period,setPeriod]=useState('all'),[source,setSource]=useState('official'),[view,setView]=useState('change');
 const archive=monitoring?.registries.find(r=>r.id==='tx-tesla-fsddb')?.historical;
 const allowArchive=filters.verification!=='verified'&&!filters.model;
 const archived=mode==='registered'&&source==='archive'&&allowArchive&&!!archive?.points.length;
 const timelineRows:Row[]=archived?archiveTimeline(archive,period):officialTimeline(monitoring?.registrationHistory??[],period);
 const rows=mode==='registered'&&!archived&&view==='change'?timelineRows.filter(r=>r.checkedAt):timelineRows;
 const eventInput=mode==='registered'?registrationChangeEvents(monitoring?.registrationHistory??[]):cityChangeEvents(data,filters);
 const events:Event[]=filterChangePeriod(eventInput,period).filter((e:Event)=>!filters.model||e.model===filters.model).sort((a:Event,b:Event)=>Date.parse(a.checkedAt)-Date.parse(b.checkedAt));
 const eventBars=mode!=='registered'||(!archived&&view==='intraday');
 const deltaView=view!=='count'||mode!=='registered';
 const officialChanges=mode==='registered'&&!archived&&!eventBars&&deltaView;
 const strictDaily=officialChanges&&view==='daily';
 const deltaKeys=strictDaily?dailyKeys:confirmationKeys;
 const models=filters.model?[filters.model]:['cybercab','model_y'];
 const title=eventBars?(mode==='registered'?'시간별 차종 증감':'도시별 차종 명부 증감'):archived?(deltaView?'텍사스 과거 등록 총계 · 일별 증감':'텍사스 과거 등록 총계 추이'):officialChanges?(strictDaily?'차종별 하루 증감':'확인 날짜별 차종 증감'):'텍사스 차종별 공식 등록 대수';
 const subtitle=archived?'FSD Database · 민간 재집계 · 출처 표기 날짜':eventBars?'동일 출처의 직전 확인값 대비 · KST':strictDaily?'TxDMV 공식 등록 · 전날 마지막 확인값 대비 · KST':'TxDMV 공식 등록 · 직전 확인일 마지막 수치 대비 · KST';
 const bar=(model:string)=>({name:names[model],type:'bar',barMaxWidth:42,barGap:'25%',label:{show:true,position:'top',fontSize:12,color:colors[model],lineHeight:17,formatter:(p:{value:number|null;data:{spanDays?:number}})=>p.value===null?'':signed(p.value)+(p.value!==0&&p.data.spanDays&&p.data.spanDays>1?`\n${p.data.spanDays}일간`:'')},itemStyle:{color:colors[model],borderRadius:[4,4,0,0]},data:rows.map(r=>({value:value(r,deltaKeys[model]),spanDays:!strictDaily?r.gapDays:1,...(!strictDaily&&Number(r.gapDays)>1?{itemStyle:{color:colors[model],borderColor:colors[model],borderWidth:1,borderType:'dashed',decal:{symbol:'rect',dashArrayX:[1,0],dashArrayY:[2,4],rotation:-Math.PI/4,color:'rgba(10,20,30,.45)'}}}:{})}))});
 const series=eventBars?[{name:'직전 확인 대비',type:'bar',barMaxWidth:36,label:{show:true,position:'top',color:'#cbd5e1',formatter:(p:{value:number})=>signed(p.value)},data:events.map(e=>({value:e.delta,itemStyle:{color:colors[e.model]}}))}]:officialChanges?models.map(bar):deltaView?[{name:'등록 순변화',type:'bar',barMaxWidth:26,itemStyle:{color:'#91acc9'},data:rows.map(r=>value(r,'deltaTotal'))}]:(archived?['total']:[...models,...(!filters.model?['total']:[])]).map(model=>({name:names[model],type:'line',step:archived?'end':false,connectNulls:false,showSymbol:!archived,symbolSize:6,lineStyle:{width:2},itemStyle:{color:archived?'#91acc9':colors[model]},data:rows.map(r=>value(r,model))}));
 const axis={axisLine:{lineStyle:{color:'#2b3b50'}},axisLabel:{color:'#a6b8ce',fontSize:11},splitLine:{lineStyle:{color:'#1d2c40'}}};
 const option={grid:{left:52,right:18,top:60,bottom:eventBars?65:48},legend:!eventBars?{top:0,textStyle:{color:'#b7c8dc'},itemWidth:16,itemHeight:7}:undefined,xAxis:{type:'category',...axis,data:eventBars?events.map(e=>`${stamp(e.checkedAt)}\n${e.city?data.cities.find(c=>c.id===e.city)?.name+' ':''}${names[e.model]}`):rows.map(r=>r.day),axisLabel:{...axis.axisLabel,fontSize:10,interval:officialChanges&&!strictDaily&&rows.length<=10?0:'auto',formatter:(s:string)=>eventBars?s:s.slice(5).replace('-','/'),hideOverlap:false},boundaryGap:deltaView},yAxis:{type:'value',...axis,minInterval:1,name:strictDaily||archived&&deltaView?'순증감 (대/일)':deltaView?'직전 확인 대비 (대)':'등록 차량 (대)',nameTextStyle:{color:'#9bb0c6',fontSize:10}},tooltip:{trigger:'axis',confine:true,formatter:(params:{dataIndex:number;seriesName:string;value:number|null}[])=>{
  const i=params[0]?.dataIndex;if(i===undefined)return '';
  if(eventBars){const e=events[i];return `<b>${escape(stamp(e.checkedAt))} 확인</b><br/>${escape(e.city?data.cities.find(c=>c.id===e.city)?.name:'텍사스 전체')} · ${names[e.model]}<br/>${signed(e.delta)}대 (${fmt(e.before)} → ${fmt(e.after)})<br/>직전 확인: ${escape(stamp(e.previousAt))}${e.gapDays>1?` · ${e.gapDays}일간 변화`:''}`;}
  const r=rows[i],values=params.map(p=>`${escape(p.seriesName)}: ${p.value===null||p.value===undefined?'비교 자료 없음':(deltaView?signed(p.value):fmt(p.value))+'대'}`).join('<br/>');
  return `<b>${r.day}${archived?' · 출처 날짜':' · KST 확인일'}</b><br/>${values}${officialChanges&&Number(r.gapDays)>1?strictDaily?`<br/>${r.gapDays}일 간격 · 하루 증감 산출 안 함`:`<br/><b>${r.previousDay} → ${r.day} · ${r.gapDays}일간 변화</b><br/>중간 날짜별 증감은 미확인`:''}${officialChanges&&r.previousDay?`<br/>비교 기준: ${escape(r.previousDay)} 마지막 확인값`:''}`;
 }},series};
 const selectedKey=filters.model||'total',known=rows.filter(r=>value(r,selectedKey)!==null);
 const comparisons=rows.filter(r=>models.some(model=>value(r,deltaKeys[model])!==null)),latest=comparisons.at(-1);
 const gapCount=rows.filter(r=>Number(r.gapDays)>1).length;
 const csv=()=>{
  let table:unknown[][],filename='robotaxi-registration-history.csv';
  if(eventBars){filename='robotaxi-confirmation-events.csv';table=[['checked_at','city','model','before','after','change_since_previous_confirmation','previous_at','gap_days','source_url'],...events.map(e=>[e.checkedAt,e.city??'Texas',e.model,e.before,e.after,e.delta,e.previousAt,e.gapDays,e.sourceUrl])];}
  else if(officialChanges){filename=strictDaily?'robotaxi-daily-model-changes.csv':'robotaxi-confirmation-model-changes.csv';table=[['date_KST',strictDaily?'daily_change_cybercab':'confirmation_change_cybercab',strictDaily?'daily_change_model_y':'confirmation_change_model_y',strictDaily?'daily_change_total':'confirmation_change_total','previous_confirmation_day','gap_days','unit','source'],...rows.map(r=>[r.day,!filters.model||filters.model==='cybercab'?value(r,deltaKeys.cybercab):null,!filters.model||filters.model==='model_y'?value(r,deltaKeys.model_y):null,!filters.model?value(r,deltaKeys.total):null,r.previousDay,r.gapDays,strictDaily?'vehicles_per_calendar_day':'vehicles_since_previous_confirmation','TxDMV official'])];}
  else table=[['date','total','cybercab','model_y','daily_change_total','date_basis','source'],...rows.map(r=>[r.day,!filters.model?value(r,'total'):null,!filters.model||filters.model==='cybercab'?value(r,'cybercab'):null,!filters.model||filters.model==='model_y'?value(r,'model_y'):null,value(r,archived?'deltaTotal':'dailyDeltaTotal'),archived?'publisher_calendar_timezone_unknown':'KST',archived?'FSD Database':'TxDMV official'])];
  const body=table.map(row=>row.map(csvCell).join(',')).join('\n'),url=URL.createObjectURL(new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const empty=eventBars?events.length?undefined:'비교 가능한 차종별 변동 기록 없음':officialChanges?comparisons.length?undefined:'해당 기간에 비교 가능한 기록 없음':known.length?undefined:'해당 기간의 확인 자료 없음';
 return <div className="fleet-history-charts" aria-label="등록 및 명부 이력 그래프">
  <div className="history-chart-controls">{mode==='registered'&&<div className="segmented" aria-label="이력 그래프 출처"><button aria-pressed={!archived} className={!archived?'active':''} onClick={()=>{setSource('official');setView('change');}}>차종별 · 공식 확인</button>{allowArchive&&<button aria-pressed={archived} className={archived?'active':''} onClick={()=>{setSource('archive');setView('count');}}>과거 총계 · 민간 재집계</button>}</div>}<div className="segmented" aria-label="이력 그래프 기간">{['7','30','90','all'].map(p=><button key={p} aria-pressed={period===p} className={period===p?'active':''} onClick={()=>setPeriod(p)}>{p==='all'?'전체':`${p}일`}</button>)}</div></div>
  <div className="history-chart-actions">{mode==='registered'&&<div className="segmented change-view-tabs" aria-label="이력 그래프 종류">{(archived?[['count','누적 대수'],['daily','일별 증감']]:[['change','확인일별 증감'],['daily','하루 증감만'],['intraday','시간별 증감'],['count','누적 대수']]).map(([id,label])=><button key={id} aria-pressed={view===id} className={view===id?'active':''} onClick={()=>setView(id)}>{label}</button>)}</div>}<button className="button subtle" onClick={csv}>CSV 저장</button></div>
  <div className="history-chart-summary"><span className="badge">{archived?'민간 재집계 · 과거 총계':mode==='registered'?'공식 등록 · 텍사스 전체':'도시별 명부 · 직전 확인 대비'}</span>{officialChanges&&latest&&<span>최근 확인 {latest.day} · {models.map(model=>`${names[model]} ${signed(value(latest,deltaKeys[model])??0)}대`).join(' / ')}</span>}</div>
  <Chart title={title} subtitle={subtitle} option={option} reduceMotion={reduceMotion} empty={empty}/>
  <p className="history-chart-summary">{eventBars?`${events.length}개 시간별·차종별 변동 · 확인일별 증감에 포함된 내역`:officialChanges?strictDaily?`전날과 비교 가능한 ${comparisons.length}일 · ${gapCount}개 다일 간격 제외`:`확인한 날짜만 표시 · 빗금 = 여러 날의 변화 · 0 = 변동 없음`:known.length?`${known[0].day} ~ ${known.at(-1)!.day} · ${known.length}일치 · ${names[selectedKey]} ${fmt(value(known[0],selectedKey))} → ${fmt(value(known.at(-1)!,selectedKey))}대`:'확인 자료가 없는 구간입니다.'}</p>
  <details className="history-source-note"><summary>출처·기준과 결측 구간 보기</summary>{archived?<><p>FSD Database의 TxDMV 일일 등록 총계입니다. 과거 차종 구분과 날짜의 시간대는 미공개이며 공식 KST 스냅샷과 합산하지 않습니다. 빈 날짜는 결측입니다.</p><p>{archive?.checkState==='failed'?'최근 수집 실패 · 마지막 정상 자료 유지. ':''}원문 생성: {archive?.sourceAsOf?stamp(archive.sourceAsOf)+' KST':'미확인'} · 최근 수집 성공: {archive?.lastSuccessAt?stamp(archive.lastSuccessAt)+' KST':'미확인'} · 최초 확보: {archive?.firstCollectedAt?stamp(archive.firstCollectedAt)+' KST':'미확인'}</p><a href={archive?.sourceUrl} target="_blank" rel="noreferrer">과거 집계 출처 ↗</a></>:<><p>확인일별 막대는 해당 날짜의 마지막 확인값에서 직전 확인일의 마지막 값을 뺀 수치입니다. 빗금 막대의 일수는 한국시간 달력 날짜 간격이며 실제 등록일이나 정확한 경과 시간을 뜻하지 않습니다. 하루 증감만 보기는 연속된 날짜만 비교합니다. 시간별 변화는 확인일별 증감에 포함되므로 다시 더하지 않습니다. 등록·명부 수치는 영업 차량 수와 다릅니다.</p><a href={mode==='registered'?monitoring?.registries.find(r=>r.id==='tx-tesla-official')?.sourceUrl:events.at(-1)?.sourceUrl} target="_blank" rel="noreferrer">집계 출처 ↗</a></>}</details>
 </div>;
}
