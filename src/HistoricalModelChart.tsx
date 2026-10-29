import {useEffect,useState} from 'react';
import {Chart} from './Chart';
import type {MonitoringDataset} from './monitoring-types';
import type {Filters} from './types';
import {historicalModelSources,modelSeries,modelConflicts} from './model-history-charts.mjs';
import {fleetLinePoints} from './registration-charts.mjs';
import './model-history.css';
type Observation={id:string;sourceId:string;date:string;cybercab:number|null;model_y:number|null;total:number|null;observedAt?:string|null;publishedAt?:string|null;firstCollectedAt?:string;sourceUrl?:string;note?:string;dateBasis?:string};
type Source={sourceId:string;name:string;url:string;verification:string;methodology?:string;dateBasis?:string;checkState?:string;lastSuccessAt?:string;error?:string;observations:Observation[]};
type Plot={source:Source;model:string;rows:{day:string;observation:Observation|null;value:number|null}[]};
const labels:Record<string,string>={cybercab:'Cybercab',model_y:'Model Y'},colors:Record<string,string>={cybercab:'#d6bd85',model_y:'#48d9cc'};
const fmt=(n:number|null)=>n===null?'—':n.toLocaleString('ko-KR');
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const time=(s:string)=>new Date(s).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})+' KST';
const basis=(s:Source,o?:Observation|null)=>{const b=o?.dateBasis??(s.sourceId==='aishiftnews-txdmv-history'&&o&&!o.observedAt?'publisher_calendar_timezone_unknown':s.dateBasis);return b==='KST_confirmation_day'?'KST 확인일':b==='UTC_snapshot_day'?'UTC 관측일':'출처 날짜 · 시간대 미공개';};
export default function HistoricalModelChart({monitoring,filters,reduceMotion,period,setPeriod,onSource}:{monitoring:MonitoringDataset|null;filters:Filters;reduceMotion:boolean;period:string;setPeriod:(s:string)=>void;onSource:(s:string)=>void}){
 const [reviewed,setReviewed]=useState<unknown>(null),[loadError,setLoadError]=useState(false),[scale,setScale]=useState('linear'),[view,setView]=useState('count');
 useEffect(()=>{const controller=new AbortController();fetch(import.meta.env.BASE_URL+'data/model-history-reviewed.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(setReviewed).catch(e=>{if(e.name!=='AbortError')setLoadError(true);});return()=>controller.abort();},[]);
 const sources=historicalModelSources(reviewed,monitoring?.modelHistory??[],monitoring?.registrationHistory??[]) as Source[];
 const end=new Date(Date.now()+9*3600000).toISOString().slice(0,10),log=scale==='log'&&view==='count';
 const plots=modelSeries(sources,{period,end,verifiedOnly:filters.verification==='verified',model:filters.model,view}) as Plot[];
 const name=(p:Plot)=>labels[p.model]+' · '+(p.source.verification==='official_single'?'공식':'비공식');
 const geometries=plots.map(p=>({...p,g:fleetLinePoints(p.rows.map(r=>({day:r.day,count:r.value})),'count',{publisherDates:true,log})}));
 const series=geometries.flatMap((p,index)=>{
  const official=p.source.verification==='official_single';
  const main={id:'point:'+index,name:name(p),type:'line',smooth:false,connectNulls:false,showSymbol:true,symbol:official?'circle':'diamond',symbolSize:official?8:5,lineStyle:{color:colors[p.model],width:official?3:1.5,type:official?'solid':'dashed',opacity:official?1:.65},itemStyle:{color:colors[p.model],opacity:official?1:.8},data:p.g.times.map((t:number,i:number)=>[t,p.g.values[i]])};
  const gaps=view==='count'?p.g.gaps.map((gap:{start:number;end:number})=>({id:'guide:'+index+':'+gap.start,name:name(p),type:'line',smooth:false,silent:true,tooltip:{show:false},showSymbol:false,lineStyle:{color:colors[p.model],width:1,type:'dotted',opacity:.22},data:[[p.g.times[gap.start],p.g.values[gap.start]],[p.g.times[gap.end],p.g.values[gap.end]]]})):[];
  return [main,...gaps];
 });
 const positive=geometries.flatMap(p=>p.g.values.filter((v:number|null)=>v!==null&&v>0)) as number[],logMin=positive.length?10**Math.floor(Math.log10(Math.min(...positive))):1;
 const option={grid:{left:54,right:22,top:78,bottom:42},legend:{top:3,data:[...new Set(plots.map(name))],textStyle:{color:'#b7c8dc',fontSize:11},itemWidth:18,itemGap:14},xAxis:{type:'time',min:geometries[0]?.g.times[0],max:geometries[0]?.g.times.at(-1),minInterval:86400000,axisLine:{lineStyle:{color:'#2b3b50'}},axisLabel:{color:'#a6b8ce',fontSize:10,hideOverlap:true,formatter:(t:number)=>new Date(t).toISOString().slice(5,10).replace('-','/')}},yAxis:{type:log?'log':'value',...(log?{logBase:10,min:logMin}:{minInterval:1}),name:view==='daily'?'전일 대비 (대/일)':log?'등록 차량 (대) · 로그':'등록 차량 (대)',nameTextStyle:{color:'#9bb0c6',fontSize:10},axisLabel:{color:'#a6b8ce',fontSize:11,formatter:(n:number)=>n.toLocaleString('ko-KR')},splitLine:{lineStyle:{color:'#1d2c40'}}},tooltip:{trigger:'axis',triggerOn:'mousemove|click',enterable:true,confine:true,extraCssText:'max-width:min(420px, calc(100vw - 40px));white-space:normal;overflow-wrap:anywhere;max-height:65vh;overflow-y:auto;line-height:1.6',backgroundColor:'#172538',borderColor:'#2b3c53',textStyle:{color:'#dce5ef',fontSize:12},formatter:(params:{seriesId:string;dataIndex:number;value:[number,number|null]}[])=>{
  const selected=params.filter(p=>p.seriesId.startsWith('point:')),day=selected[0]?new Date(selected[0].value[0]).toISOString().slice(0,10):'';
  const items=selected.filter(p=>p.value[1]!==null&&p.value[1]!==undefined).map(p=>{const plot=plots[Number(p.seriesId.slice(6))],o=plot.rows[p.dataIndex]?.observation;return '<b>'+esc(name(plot))+' '+fmt(p.value[1])+'대</b><br/>'+esc(plot.source.name)+' · '+basis(plot.source,o)+(o?.observedAt?'<br/>실제 조회 '+esc(time(o.observedAt)):'')+(o?.note?'<br/>'+esc(o.note):'');});
  return '<b>'+day+'</b><br/>'+(items.length?items.join('<br/><br/>'):'차종별 확인 자료 없음 · 숫자를 채우지 않음');
 }},series};
 const observed=plots.flatMap(p=>p.rows.filter(r=>r.value!==null).map(r=>({...r,model:p.model,source:p.source})));
 const dates=[...new Set(observed.map(o=>o.day))].sort(),conflicts=modelConflicts(sources).filter(c=>dates.includes(c.date));
 const missing=geometries[0]?.g.times.length?geometries[0].g.times.length-dates.length:0;
 const exportCsv=()=>{
  const header=['date_label','model','registered_vehicles_or_daily_change','unit','verification','source','source_url','date_basis','observed_at','published_at','first_collected_at','note'];
  const rows=plots.flatMap(p=>p.rows.map(r=>[r.day,p.model,r.value,view==='daily'?'vehicles_per_day':'vehicles',r.observation?p.source.verification:'not_collected',r.observation?p.source.name:'',r.observation?.sourceUrl??(r.observation?p.source.url:''),basis(p.source,r.observation),r.observation?.observedAt,r.observation?.publishedAt,r.observation?.firstCollectedAt,r.observation?.note]));
  const body=[header,...rows].map(row=>row.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\n'),url=URL.createObjectURL(new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='robotaxi-model-history-sourced.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const unique=[...new Map(observed.map(o=>[o.source.sourceId+':'+o.day,o])).values()].sort((a,b)=>b.day.localeCompare(a.day));
 return <div className="fleet-history-charts model-history" aria-label="공식 비공식 차종별 과거 그래프">
  <div className="history-chart-controls"><div className="segmented" aria-label="이력 그래프 출처"><button className="active" aria-pressed="true">차종별 · 전체 근거</button><button onClick={()=>onSource('archive')}>장기 총계 · 과거부터</button><button onClick={()=>onSource('official')}>차종별 · 공식 확인</button></div><div className="segmented" aria-label="이력 그래프 기간">{['7','30','90','all'].map(p=><button key={p} aria-pressed={period===p} className={period===p?'active':''} onClick={()=>setPeriod(p)}>{p==='all'?'전체':p+'일'}</button>)}</div></div>
  <div className="model-history-intro"><span className="badge">텍사스 등록 · 차종별</span><span>공식 <i className="solid-key"/> 비공식 <i className="dash-key"/></span><details className="chart-settings"><summary>그래프 설정</summary><div className="history-chart-actions"><div className="segmented"><button className={view==='count'?'active':''} onClick={()=>setView('count')}>누적 대수</button><button className={view==='daily'?'active':''} onClick={()=>{setView('daily');setScale('linear');}}>하루 증감</button></div><div className="segmented"><button className={!log?'active':''} onClick={()=>setScale('linear')}>일반 축</button><button className={log?'active':''} disabled={view!=='count'} onClick={()=>setScale('log')}>로그 축</button></div><button className="button subtle" onClick={exportCsv}>CSV 저장</button></div></details></div>
  <Chart title={view==='count'?'차종별 등록 추이 · 공식·비공식':'차종별 하루 증감 · 출처별'} subtitle={'텍사스 전체 등록 · 2026.06.09부터 · 공식 실선 / 비공식 파선 · 결측 구간은 희미한 안내선'+(log?' · 로그 축':'')} option={option} reduceMotion={reduceMotion} compact empty={!observed.length?'선택한 기간에 차종별 확인 자료가 없습니다':undefined}/>
  <p className="history-chart-summary">{dates.length?dates[0]+' ~ '+dates.at(-1)+' · '+dates.length+'일 근거 확보 · '+missing+'일 차종 자료 없음':'확보한 차종별 자료를 불러오는 중입니다.'}</p>
  <p className="chart-key-note">점 = 확인 기록 · 희미한 점선 = 결측 구간 안내 · 등록 대수는 배치·영업 대수와 다릅니다.</p>
  <details className="history-source-note"><summary>출처와 날짜별 수치 보기{conflicts.length?' · 출처 차이 '+conflicts.length+'일':''}</summary>
   <p>6월 9일 Texas AV Tracker의 당시 명부는 Model Y 59대(Cybercab 0대)이며 별도 FSD Database 총계는 69대입니다. 출처 차이로 남기고 69대를 차종에 임의 배분하지 않습니다.</p><p>6월 9일부터 확보한 날짜만 표시합니다. 출처별 독립 시리즈이며 공식·비공식 수치를 합산하거나 평균내지 않습니다. 같은 TxDMV를 재인용한 자료는 독립 검증으로 세지 않습니다. 하루 증감은 같은 출처에서 연속된 날짜를 비교할 때만 계산합니다.</p>
   <p>날짜 라벨은 출처별 날짜 체계를 따릅니다. UTC·KST·시간대 미공개 일자는 실제 확인 시각이 달라 같은 날짜에도 수치가 다를 수 있습니다. 출처 차이는 원값 그대로 보존합니다. 희미한 안내선 사이의 날짜에는 관측값이 없으며 CSV도 빈칸입니다. 로그 축에서 0은 그림에서만 제외합니다.</p>
   {loadError&&<p>검토 기사 파일을 불러오지 못했습니다. 자동 수집과 공식 기록만 표시합니다.</p>}
   {sources.map(s=><p key={s.sourceId}><a href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a> · {s.verification==='official_single'?'공식 직접 확인':'비공식'} · {basis(s)}<br/>{s.methodology}{s.checkState==='failed'?' 최근 자동 수집 실패 · 마지막 정상값과 원래 날짜 유지.':''}</p>)}
   <div className="table-scroll"><table><thead><tr><th>기준 날짜</th><th>Cybercab</th><th>Model Y</th><th>등록 합계</th><th>출처·확인 시각</th></tr></thead><tbody>{unique.map(o=><tr key={o.source.sourceId+o.day}><td data-label="기준 날짜">{o.day}<small>{basis(o.source,o.observation)}</small></td><td data-label="Cybercab">{fmt(o.observation?.cybercab??null)}</td><td data-label="Model Y">{fmt(o.observation?.model_y??null)}</td><td data-label="등록 합계">{fmt(o.observation?.total??null)}</td><td data-label="출처·시각"><a href={o.observation?.sourceUrl??o.source.url} target="_blank" rel="noreferrer">{o.source.name} ↗</a><small>{o.source.verification==='official_single'?'공식 직접 확인':'비공식'}{o.observation?.observedAt?' · '+time(o.observation.observedAt):''}</small><small>{o.observation?.note}</small></td></tr>)}</tbody></table></div>
  </details>
 </div>;
}
