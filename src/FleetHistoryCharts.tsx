import {useState} from 'react';
import {Chart} from './Chart';
import type {Dataset,Filters} from './types';
import type {MonitoringDataset} from './monitoring-types';
import {officialTimeline,filterChangePeriod,fleetLinePoints,longTermTimeline} from './registration-charts.mjs';
import {cityChangeEvents,registrationChangeEvents} from './fleet-changes.mjs';
const names:Record<string,string>={cybercab:'Cybercab',model_y:'Model Y',total:'등록 합계',official_total:'직접 확인 총계'};
const colors:Record<string,string>={cybercab:'#d6bd85',model_y:'#48d9cc',total:'#c4d4e5',official_total:'#dce5ef'};
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
 const [period,setPeriod]=useState('all'),[source,setSource]=useState('archive'),[view,setView]=useState('count'),[scale,setScale]=useState('linear');
 const archive=monitoring?.registries.find(r=>r.id==='tx-tesla-fsddb')?.historical;
 const allowArchive=filters.verification!=='verified'&&!filters.model;
 const archived=mode==='registered'&&source==='archive'&&allowArchive&&!!archive?.points.length;
 const timelineRows:Row[]=archived?longTermTimeline(archive,monitoring?.registrationHistory??[],period):officialTimeline(monitoring?.registrationHistory??[],period);
 const rows=timelineRows;
 const eventInput=mode==='registered'?registrationChangeEvents(monitoring?.registrationHistory??[]):cityChangeEvents(data,filters);
 const events:Event[]=filterChangePeriod(eventInput,period).filter((e:Event)=>!filters.model||e.model===filters.model).sort((a:Event,b:Event)=>Date.parse(a.checkedAt)-Date.parse(b.checkedAt));
 const eventLines=mode!=='registered'||(!archived&&view==='intraday');
 const deltaView=view!=='count'||mode!=='registered';
 const officialChanges=mode==='registered'&&!archived&&!eventLines&&deltaView;
 const strictDaily=officialChanges&&view==='daily';
 const deltaKeys=strictDaily?dailyKeys:confirmationKeys;
 const canLog=mode==='registered'&&view==='count',logOn=canLog&&scale==='log';
 const models=filters.model?[filters.model]:['cybercab','model_y'];
 const title=eventLines?(mode==='registered'?'시간별 차종 증감':'도시별 차종 명부 증감'):archived?(deltaView?'텍사스 과거 등록 총계 · 일별 증감':period==='all'?'69대부터 보는 텍사스 등록 추이':'텍사스 등록 대수 추이'):officialChanges?(strictDaily?'차종별 하루 증감':'확인 날짜별 차종 증감'):'텍사스 차종별 등록 대수 추이';
 const sourceSubtitle=archived?(deltaView?'FSD Database · 출처 날짜별 증감':'과거: 민간 출처 날짜 · 직접 확인: 한국 날짜 · 출처별 별도 선'):eventLines?'동일 출처의 직전 확인값 대비 · KST':strictDaily?'TxDMV 공식 등록 · 전날 마지막 확인값 대비 · KST':deltaView?'TxDMV 공식 등록 · 직전 확인일 마지막 수치 대비 · KST':'TxDMV 공식 등록 · 확인 날짜별 누적 대수 · KST';
 const subtitle=sourceSubtitle+' · '+(logOn?'로그 축 (밑 10)':'일반 축');
 const countModels=archived?['total','official_total']:[...models,...(!filters.model?['total']:[])];
 const plotModels=officialChanges?models:deltaView?['total']:countModels;
 const field=(model:string)=>officialChanges?deltaKeys[model]:deltaView?'deltaTotal':model;
 const geometries=plotModels.map(model=>({model,geometry:fleetLinePoints(rows,field(model),{log:logOn,publisherDates:archived})}));
 const nameFor=(model:string)=>archived&&!deltaView?(model==='total'?'과거 총계 · 민간':'직접 확인 · KST'):names[model];
 const excluded=geometries.reduce((n,g)=>n+g.geometry.excluded,0);
 const lineSeries=geometries.flatMap(({model,geometry})=>{
  const color=archived?(model==='official_total'?'#dce5ef':'#91acc9'):colors[model];
  const first=geometry.values.findIndex((v:number|null)=>v!==null);
  const last=geometry.values.findLastIndex((v:number|null)=>v!==null);
  const main={id:'main:'+model,name:nameFor(model),type:'line',smooth:false,connectNulls:false,showSymbol:true,symbolSize:archived&&model==='total'?3:7,lineStyle:{width:2.5,color},itemStyle:{color},label:{show:true,position:deltaView?'top':model==='model_y'?'bottom':'top',fontSize:11,color,formatter:(p:{value:[number,number|null];dataIndex:number})=>p.value[1]===null?'':deltaView?signed(p.value[1])+(officialChanges&&!strictDaily&&p.value[1]!==0&&Number(rows[p.dataIndex].gapDays)>1?'\n'+rows[p.dataIndex].gapDays+'일간':''):p.dataIndex===(archived&&model==='total'?first:last)?fmt(p.value[1]):''},labelLayout:{hideOverlap:true},data:geometry.times.map((t:number,i:number)=>[t,geometry.values[i]])};
  const gaps=geometry.gaps.map((g:{start:number;end:number})=>({id:'gap:'+model+':'+g.start,name:nameFor(model),type:'line',smooth:false,connectNulls:true,showSymbol:false,silent:true,tooltip:{show:false},emphasis:{disabled:true},lineStyle:{width:2,color,type:'dashed',opacity:.7},data:geometry.times.map((t:number,i:number)=>[t,i===g.start||i===g.end?geometry.values[i]:null])}));
  return [main,...gaps];
 });
 const eventGroups=[...new Map(events.map(e=>[(e.city??'Texas')+'|'+e.model,{city:e.city,model:e.model}])).values()];
 const eventSeries=eventGroups.map(group=>({id:'event:'+(group.city??'Texas')+':'+group.model,name:(group.city?(data.cities.find(c=>c.id===group.city)?.name??group.city)+' · ':'')+names[group.model],type:'line',smooth:false,connectNulls:true,showSymbol:true,symbolSize:7,lineStyle:{width:2.5,color:colors[group.model]},itemStyle:{color:colors[group.model]},label:{show:true,position:'top',fontSize:11,formatter:(p:{value:[number,number|null]})=>p.value[1]===null?'':signed(p.value[1])},data:events.map(e=>[Date.parse(e.checkedAt),e.city===group.city&&e.model===group.model?e.delta:null])}));
 const series=eventLines?eventSeries:lineSeries;
 const times=eventLines?events.map(e=>Date.parse(e.checkedAt)):geometries[0]?.geometry.times??[];
 const positives=geometries.flatMap(g=>g.geometry.values.filter((v:number|null)=>v!==null&&v>0)) as number[];
 const logMin=positives.length?10**Math.floor(Math.log10(Math.min(...positives))):1;
 const logMax=positives.length?Math.max(logMin*10,Math.max(...positives)*1.2):10;
 const axis={axisLine:{lineStyle:{color:'#2b3b50'}},axisLabel:{color:'#a6b8ce',fontSize:11},splitLine:{lineStyle:{color:'#1d2c40'}}};
 const option={grid:{left:58,right:55,top:45,bottom:45},legend:{top:0,data:eventLines?eventSeries.map(s=>s.name):plotModels.map(nameFor),textStyle:{color:'#b7c8dc'},itemWidth:16,itemHeight:7},xAxis:{type:'time',...axis,min:times[0],max:times.length>1?times.at(-1):undefined,minInterval:eventLines?3600000:86400000,axisLabel:{...axis.axisLabel,fontSize:10,hideOverlap:true,formatter:(n:number)=>new Date(n+(archived?0:9*3600000)).toISOString().slice(5,10).replace('-','/')}},yAxis:{type:logOn?'log':'value',...axis,...(logOn?{logBase:10,min:logMin,max:logMax}:{minInterval:1}),name:logOn?'등록 차량 (대) · 로그':strictDaily||archived&&deltaView?'순증감 (대/일)':deltaView?'직전 확인 대비 (대)':'등록 차량 (대)',nameTextStyle:{color:'#9bb0c6',fontSize:10},axisLabel:{...axis.axisLabel,showMaxLabel:!logOn,formatter:(n:number)=>n.toLocaleString('ko-KR')}},tooltip:{trigger:'axis',confine:true,formatter:(all:{dataIndex:number;seriesId:string;seriesName:string;value:[number,number|null]}[])=>{
  const params=all.filter(p=>!p.seriesId.startsWith('gap:'));const i=params[0]?.dataIndex;if(i===undefined)return '';
  if(eventLines){const at=params[0].value[0],matches=events.filter(e=>Date.parse(e.checkedAt)===at);return '<b>'+escape(stamp(new Date(at).toISOString()))+' 확인</b><br/>'+matches.map(e=>escape(e.city?data.cities.find(c=>c.id===e.city)?.name:'텍사스 전체')+' · '+names[e.model]+': '+signed(e.delta)+'대 ('+fmt(e.before)+' → '+fmt(e.after)+')<br/>직전 확인 '+escape(stamp(e.previousAt))).join('<br/>');}
  const r=rows[i];if(!r)return '';
  const values=[...new Map(params.map(p=>[p.seriesName,p])).values()].map(p=>escape(p.seriesName)+': '+(p.value[1]===null||p.value[1]===undefined?'자료 없음':(deltaView?signed(p.value[1]):fmt(p.value[1]))+'대')).join('<br/>');
  return '<b>'+r.day+(archived?' · 출처 날짜':' · KST 확인일')+'</b><br/>'+values+(officialChanges&&Number(r.gapDays)>1?strictDaily?'<br/>'+r.gapDays+'일 간격 · 하루 증감 산출 안 함':'<br/>'+r.previousDay+' → '+r.day+' · '+r.gapDays+'일간 변화':'')+(archived&&!deltaView?'<br/>과거: 출처 표기 날짜(시간대 미공개)<br/>직접 확인: 한국 날짜'+(typeof r.officialCheckedAt==='string'?'<br/>조회 '+escape(stamp(r.officialCheckedAt))+' KST':'')+(typeof r.officialValueAsOf==='string'?'<br/>수치 최초 확인 '+escape(stamp(r.officialValueAsOf))+' KST':''):'')+(logOn?'<br/>로그 축 · 표시값은 원래 차량 대수':'');
 }},series};
 const selectedKey=filters.model||'total',known=rows.filter(r=>value(r,selectedKey)!==null);
 const comparisons=rows.filter(r=>models.some(model=>value(r,deltaKeys[model])!==null)),latest=comparisons.at(-1);
 const officialKnown=rows.filter(r=>value(r,'official_total')!==null),latestOfficial=officialKnown.at(-1);
 const gapCount=rows.filter(r=>Number(r.gapDays)>1).length;
 const csv=()=>{
  let table:unknown[][],filename='robotaxi-registration-history.csv';
  if(eventLines){filename='robotaxi-confirmation-events.csv';table=[['checked_at','city','model','before','after','change_since_previous_confirmation','previous_at','gap_days','source_url'],...events.map(e=>[e.checkedAt,e.city??'Texas',e.model,e.before,e.after,e.delta,e.previousAt,e.gapDays,e.sourceUrl])];}
  else if(officialChanges){filename=strictDaily?'robotaxi-daily-model-changes.csv':'robotaxi-confirmation-model-changes.csv';table=[['date_KST',strictDaily?'daily_change_cybercab':'confirmation_change_cybercab',strictDaily?'daily_change_model_y':'confirmation_change_model_y',strictDaily?'daily_change_total':'confirmation_change_total','previous_confirmation_day','gap_days','unit','source'],...rows.map(r=>[r.day,!filters.model||filters.model==='cybercab'?value(r,deltaKeys.cybercab):null,!filters.model||filters.model==='model_y'?value(r,deltaKeys.model_y):null,!filters.model?value(r,deltaKeys.total):null,r.previousDay,r.gapDays,strictDaily?'vehicles_per_calendar_day':'vehicles_since_previous_confirmation','TxDMV official'])];}
  else if(archived&&!deltaView){filename='robotaxi-long-term-daily-history.csv';table=[['date_label','private_registered_total','private_source_date','private_date_basis','official_registered_total','official_date_basis','official_checked_at','official_value_as_of','private_source_url','official_source_url'],...rows.map(r=>[r.day,value(r,'total'),r.privateSourceDate,'publisher_calendar_timezone_unknown',value(r,'official_total'),'KST_confirmation_day',r.officialCheckedAt,r.officialValueAsOf,archive?.sourceUrl,r.officialSourceUrl])];}
  else table=[['date','total','cybercab','model_y','daily_change_total','date_basis','source'],...rows.map(r=>[r.day,!filters.model?value(r,'total'):null,!filters.model||filters.model==='cybercab'?value(r,'cybercab'):null,!filters.model||filters.model==='model_y'?value(r,'model_y'):null,value(r,archived?'deltaTotal':'dailyDeltaTotal'),archived?'publisher_calendar_timezone_unknown':'KST',archived?'FSD Database':'TxDMV official'])];
  const body=table.map(row=>row.map(csvCell).join(',')).join('\n'),url=URL.createObjectURL(new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const hasCountData=geometries.some(g=>g.geometry.values.some((v:number|null)=>v!==null));
 const empty=logOn&&!positives.length?'로그 축에 표시할 양수 대수가 없습니다':eventLines?events.length?undefined:'비교 가능한 차종별 변동 기록 없음':officialChanges?comparisons.length?undefined:'해당 기간에 비교 가능한 기록 없음':hasCountData?undefined:'해당 기간의 확인 자료 없음';
 return <div className="fleet-history-charts" aria-label="등록 및 명부 이력 그래프">
  <div className="history-chart-controls">{mode==='registered'&&<div className="segmented" aria-label="이력 그래프 출처">{allowArchive&&<button aria-pressed={archived} className={archived?'active':''} onClick={()=>{setSource('archive');setView('count');}}>장기 총계 · 과거부터</button>}<button aria-pressed={!archived} className={!archived?'active':''} onClick={()=>{setSource('official');setView('count');}}>차종별 · 공식 확인</button></div>}<div className="segmented" aria-label="이력 그래프 기간">{['7','30','90','all'].map(p=><button key={p} aria-pressed={period===p} className={period===p?'active':''} onClick={()=>setPeriod(p)}>{p==='all'?'전체':`${p}일`}</button>)}</div></div>
  <div className="history-chart-actions">{mode==='registered'&&<div className="segmented change-view-tabs" aria-label="이력 그래프 종류">{(archived?[['count','누적 대수'],['daily','일별 증감']]:[['count','누적 대수'],['change','확인일별 증감'],['daily','하루 증감만'],['intraday','시간별 증감']]).map(([id,label])=><button key={id} aria-pressed={view===id} className={view===id?'active':''} onClick={()=>setView(id)}>{label}</button>)}</div>}<div className="chart-scale-switch segmented" aria-label="그래프 세로 축"><button aria-pressed={!logOn} className={!logOn?'active':''} onClick={()=>setScale('linear')}>일반 축</button><button aria-pressed={logOn} className={logOn?'active':''} disabled={!canLog} title={canLog?'같은 세로 간격은 10배를 뜻합니다':'로그 축은 양수인 누적 대수에서 사용합니다'} onClick={()=>setScale('log')}>로그 축</button></div><button className="button subtle" onClick={csv}>CSV 저장</button></div>
  <div className="history-chart-summary"><span className="badge">{archived?'과거 이력 + 직접 확인 · 출처 분리':mode==='registered'?'공식 등록 · 텍사스 전체':'도시별 명부 · 직전 확인 대비'}</span>{officialChanges&&latest&&<span>최근 확인 {latest.day} · {models.map(model=>`${names[model]} ${signed(value(latest,deltaKeys[model])??0)}대`).join(' / ')}</span>}</div>
  {archived&&!deltaView&&known.length>0&&<p className="long-term-start"><b>{known[0].day} · {fmt(value(known[0],'total'))}대부터</b>{latestOfficial&&<span>최근 직접 확인 {latestOfficial.day} · {fmt(value(latestOfficial,'official_total'))}대</span>}</p>}
  <Chart title={title} subtitle={subtitle} option={option} reduceMotion={reduceMotion} empty={empty}/>
  <p className="history-chart-summary">{eventLines?`${events.length}개 시간별·차종별 변동 · 확인일별 증감에 포함된 내역`:officialChanges?strictDaily?`전날과 비교 가능한 ${comparisons.length}일 · ${gapCount}개 다일 간격 제외`:`선·점 = 확인값 · 점선 = 미수집 구간 연결 · 0 = 변동 없음`:known.length?`${known[0].day} ~ ${known.at(-1)!.day} · ${known.length}일치 · ${names[selectedKey]} ${fmt(value(known[0],selectedKey))} → ${fmt(value(known.at(-1)!,selectedKey))}대`:archived&&!deltaView&&latestOfficial?`직접 확인 ${officialKnown[0].day} ~ ${latestOfficial.day} · ${officialKnown.length}일치 · ${fmt(value(latestOfficial,'official_total'))}대`:'확인 자료가 없는 구간입니다.'}</p>
  <p className="line-chart-note">점선은 확인값 사이를 연결한 안내선이며 중간 날짜의 관측값이 아닙니다.{archived&&!deltaView?' 성공한 한국 날짜마다 직접 확인점을 추가합니다. 대수가 같아도 기록하며 실패일은 비워 둡니다.':''}{logOn?' 로그 축의 같은 세로 간격은 10배를 뜻합니다.':''}{excluded>0?' 로그 축에서 0 이하 수치 '+excluded+'개는 표시하지 않으며 원자료와 CSV에는 보존합니다.':''}</p>
  <details className="history-source-note"><summary>출처·기준과 결측 구간 보기</summary>{archived?<><p>과거 선은 FSD Database의 TxDMV 일일 등록 총계이고, 직접 확인 선은 이 사이트가 조회한 TxDMV 한국 날짜별 기록입니다. 서로 다른 날짜 체계의 값을 합산·평균하거나 하나의 선으로 이어 붙이지 않습니다. 과거 차종 구분과 날짜의 시간대는 미공개이며 공식 KST 스냅샷과 합산하지 않습니다. 빈 날짜는 결측입니다.</p><p>{archive?.checkState==='failed'?'최근 수집 실패 · 마지막 정상 자료 유지. ':''}원문 생성: {archive?.sourceAsOf?stamp(archive.sourceAsOf)+' KST':'미확인'} · 최근 수집 성공: {archive?.lastSuccessAt?stamp(archive.lastSuccessAt)+' KST':'미확인'} · 최초 확보: {archive?.firstCollectedAt?stamp(archive.firstCollectedAt)+' KST':'미확인'}</p><a href={archive?.sourceUrl} target="_blank" rel="noreferrer">과거 집계 출처 ↗</a></>:<><p>확인일별 증감은 해당 날짜의 마지막 확인값에서 직전 확인일의 마지막 값을 뺀 수치입니다. 증감 라벨의 일수는 한국시간 달력 날짜 간격이며 실제 등록일이나 정확한 경과 시간을 뜻하지 않습니다. 하루 증감만 보기는 연속된 날짜만 비교합니다. 시간별 변화는 확인일별 증감에 포함되므로 다시 더하지 않습니다. 등록·명부 수치는 영업 차량 수와 다릅니다.</p><a href={mode==='registered'?monitoring?.registries.find(r=>r.id==='tx-tesla-official')?.sourceUrl:events.at(-1)?.sourceUrl} target="_blank" rel="noreferrer">집계 출처 ↗</a></>}</details>
 </div>;
}
