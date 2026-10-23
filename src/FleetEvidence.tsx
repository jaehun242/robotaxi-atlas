import type {Dataset} from './types';
import {latest} from './domain.mjs';
const names:Record<string,string>={cybercab:'Cybercab',model_y:'Model Y',unspecified:'차종 미확정'};
const kst=(value:string|null)=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})+' KST':'미확인';
export default function FleetEvidence({data,city,verification='credible'}:{data:Dataset;city:string;verification?:string}){
 const rows=latest(data,{country:'',region:'',city,model:'',status:'',basis:'observed',verification});
 const examples=data.observations.filter(o=>o.city===city&&o.verification==='unverified');
 const research=data.fleetResearch?.find(r=>r.city===city),refs=verification==='verified'?[]:data.fleetReferences?.filter(r=>r.city===city)??[];
 const sourceRun=data.sourceRuns.find(s=>s.sourceId==='pioneer-tracker');
 return <section className="fleet-evidence" aria-label="차량 수 조사와 참고값"><h3>차량 수 조사 · 근거와 범위</h3><p className="fleet-definition">명부는 배정·배치·당일 운행 대수가 아닙니다. 검토한 비공식 명부를 기본 표시하고 공식만 보기로 제외할 수 있습니다.</p>
  {rows.length>0&&<div className="fleet-records">{rows.map(o=><article key={o.id}><span className="badge">비공식 추적 명부</span><div><b className={o.model==='cybercab'?'gold':'teal'}>{names[o.model]}</b><strong>{o.count.toLocaleString('ko-KR')}<small>대 기록</small></strong></div><p>{o.scope}</p><small>수치 기준 {kst(o.asOf)}<br/>최초 수집 {kst(o.collectedAt)}</small><a href={o.sourceUrl} target="_blank" rel="noreferrer">Pioneerlands / Robotaxi Tracker 원자료 ↗</a>{o.count===0&&<p>명부에 해당 차종 0건 · 실제 차량 0대라는 뜻은 아닙니다.</p>}</article>)}</div>}
  {verification==='verified'&&<p>공식·독립 검증 필터: 비공식 명부 대수는 제외했습니다.</p>}
  {refs.map(r=><article className="regional-reference" key={r.id}><b>광역 참고값 · 도시 합계 제외</b><p>{r.scope}</p><strong>Cybercab {r.cybercab.toLocaleString('ko-KR')} · Model Y {r.model_y.toLocaleString('ko-KR')}대 기록</strong><small>{kst(r.asOf)} 기준</small><p>{r.note}</p><a href={r.sourceUrl} target="_blank" rel="noreferrer">광역 명부 원자료 ↗</a></article>)}
  {examples.length>0&&<div className="unverified-reference"><b>사용자 제공 미검증 참고값 · 합계·증감 제외</b>{examples.map(o=><p key={o.id}>{names[o.model]} <strong>{o.count.toLocaleString('ko-KR')}대</strong> · 기준일·배정/배치/영업 구분 미확인 <a href={o.sourceUrl} target="_blank" rel="noreferrer">제공된 원문 ↗</a></p>)}<small>원문 요청 403. 아래 확인 명부를 대신 검증한 것으로 취급하지 않습니다.</small></div>}
  {sourceRun&&<p className={sourceRun.state==='ok'?'source-ok':'field-error'}>자동 수집 {sourceRun.state==='ok'?'성공':sourceRun.state==='failed'?'실패 · 마지막 정상값 유지':'재검토 필요'} · 확인 시도 {kst(sourceRun.checkedAt)}<br/>{sourceRun.message}</p>}
  {research&&<details className="fleet-audit"><summary>조사한 출처와 미확보 사유</summary><p>{research.reason}</p><small>수동 원문 검토 {kst(research.checkedAt)} · 자동 수집 시도와 별개</small>{research.sources.map(s=><p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a><br/>{s.result}</p>)}</details>}
 </section>;
}
