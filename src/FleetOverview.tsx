import {useState} from 'react';
import {ArrowUpRight,RefreshCw} from 'lucide-react';
import type {Dataset,Filters} from './types';
import type {MonitoringDataset} from './monitoring-types';
import {aggregate,latest} from './domain.mjs';
const format=(n:number|null|undefined)=>n==null?'—':n.toLocaleString('ko-KR');
const day=(v:string|null|undefined)=>v?new Date(v).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'}):'';
const stamp=(v:string|null|undefined)=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'기준 미확인';
export default function FleetOverview({data,monitoring,filters,demo,refreshing,onRefresh,onSources}:{data:Dataset;monitoring:MonitoringDataset|null;filters:Filters;demo:boolean;refreshing:boolean;onRefresh:()=>void;onSources:()=>void}){
 const [mode,setMode]=useState('registered');
 const registry=monitoring?.registries.find(r=>r.id==='tx-tesla-official');
 const registered=mode==='registered'&&!demo;
 const rows=latest(data,filters),totals=aggregate(rows);
 const values=registered?{total:registry?.total,cybercab:registry?.cybercab,model_y:registry?.model_y}:totals;
 const place=data.cities.find(c=>c.id===filters.city)?.name??data.cities.find(c=>c.region===filters.region)?.regionName??'미국 · 확인된 도시';
 const basis=({observed:'추적 명부',allocated:'배정',deployed:'현지 배치',testing:'시험운행',commercial:'상업운행'} as Record<string,string>)[filters.basis];
 const asOf=registered?registry?.asOf:totals.asOf;
 const sourceRun=data.sourceRuns.find(s=>s.sourceId==='pioneer-tracker');
 const total=values.total??null,cybercab=values.cybercab??null,modelY=values.model_y??null;
 const share=(value:number|null)=>total&&value!==null?Math.max(0,Math.min(100,value/total*100)):0;
 return <section className="fleet-overview" aria-label="차량 현황 요약">
  <div className="overview-mode-row"><div className="overview-mode segmented" aria-label="차량 현황 기준"><button aria-pressed={registered} className={registered?'active':''} onClick={()=>setMode('registered')} disabled={demo}>텍사스 등록</button><button aria-pressed={!registered} className={!registered?'active':''} onClick={()=>setMode('tracked')}>도시 추적 명부</button></div><div className="overview-check"><span>수집 {stamp(data.lastAttemptAt)} KST</span><button aria-label="게시 데이터 새로고침" onClick={onRefresh} disabled={refreshing}><RefreshCw size={14} className={refreshing?'refreshing':''}/></button></div></div>
  <div className="fleet-readouts">
   {[{label:registered?'텍사스 등록 합계':place+' · '+basis,value:total,className:'total',hint:registered?'TxDMV · 주 전체':'동일 기준의 확인된 부분 합계'},{label:'Cybercab',value:cybercab,className:'gold',hint:registered?'텍사스 등록':'도시별 '+basis},{label:'Model Y',value:modelY,className:'teal',hint:registered?'텍사스 등록':'도시별 '+basis}].map(item=><article className={'fleet-readout '+item.className} key={item.className}><span className="readout-label">{item.label}</span><strong title={!registered&&filters.basis==='observed'&&item.value===0?'명부 미포착 · 실제 차량 0대를 뜻하지 않습니다':undefined}>{format(item.value)}<small>{item.value==null?!registered&&filters.model&&item.className!=='total'&&item.className!==(filters.model==='cybercab'?'gold':'teal')?'필터 제외':'미확인':!registered&&filters.basis==='observed'&&item.value===0?'건':'대'}</small></strong><div className="readout-rail">{item.className==='total'?<><i className="gold" style={{width:share(cybercab)+'%'}}/><i className="teal" style={{width:share(modelY)+'%'}}/></>:<i className={item.className} style={{width:share(item.value)+'%'}}/>}</div><div className="readout-foot"><span>{item.hint}</span><span>{item.value==null?'자료 없음':day(asOf)}</span></div></article>)}
  </div>
  <div className="overview-attribution"><span>{registered?'공식 등록 · 오스틴 배치·영업 대수와 별개':demo?'DEMO · 가상 데이터':filters.basis==='observed'?'Robotaxi Tracker 기반 · 공개 미러의 비공식 명부':'선택한 집계 기준 · 다른 기준과 합산하지 않음'}</span><details><summary>숫자 읽는 법</summary><div><p>{registered?'텍사스 주 전체의 등록 기록입니다. 도시별 배치나 현재 승객을 태우는 차량 수가 아닙니다.':'도시 명부는 한 번 이상 포착·등록된 차량의 기록입니다. 당일 실제 영업 대수나 전체 차량을 뜻하지 않습니다. 0건은 해당 명부에 기록이 없다는 뜻입니다.'}</p><p>수치 기준 {stamp(asOf)} KST. {registered&&registry?.checkState!=='ok'?'최근 수집 실패 · 마지막 정상값 유지.':!registered&&sourceRun?.state!=='ok'?'명부 재수집 상태는 출처 탭에서 확인할 수 있습니다.':''}</p>{registered?<a href={registry?.sourceUrl} target="_blank" rel="noreferrer">TxDMV 원본 <ArrowUpRight size={12}/></a>:<><a href="https://robotaxitracker.com/" target="_blank" rel="noreferrer">Robotaxi Tracker <ArrowUpRight size={12}/></a><a href="https://pioneerlands.org/cybercabtracker" target="_blank" rel="noreferrer">공개 집계 미러 <ArrowUpRight size={12}/></a></>}<button onClick={onSources}>모든 출처·집계 기준 →</button></div></details></div>
 </section>;
}
