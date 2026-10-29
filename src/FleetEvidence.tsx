import type {Dataset} from './types';
import {latest} from './domain.mjs';
import {alternateCityClaim,formatClaimCount} from './preferred-city-claim.mjs';
const names:Record<string,string>={cybercab:'Cybercab',model_y:'Model Y',unspecified:'차종 미확정'};
const kst=(value:string|null)=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})+' KST':'미확인';
const claimDay=(value:string|null|undefined)=>value?value.slice(0,10).replaceAll('-','.'):'미확인';
export default function FleetEvidence({data,city,verification='credible'}:{data:Dataset;city:string;verification?:string}){
 const claim=alternateCityClaim(data,{country:'',region:'',city,model:'',status:'',basis:'observed',verification},city,'cybercab');
 const rows=latest(data,{country:'',region:'',city,model:'',status:'',basis:'observed',verification});
 const examples=data.observations.filter(o=>o.city===city&&o.verification==='unverified');
 const research=data.fleetResearch?.find(r=>r.city===city),refs=verification==='verified'?[]:data.fleetReferences?.filter(r=>r.city===city)??[];
 const sourceRun=data.sourceRuns.find(s=>s.sourceId==='pioneer-tracker');
 return <section className="fleet-evidence" aria-label="차량 수 조사와 참고값"><h3>차량 수 근거</h3><p className="fleet-definition">도시 기본값은 Robotaxi Tracker의 공개 명부 집계입니다. 배정·배치·당일 영업 대수와 구분합니다.</p>
  {rows.length>0&&<div className="fleet-records">{rows.map(o=><article key={o.id}><span className="badge">비공식 추적 명부</span><div><b className={o.model==='cybercab'?'gold':'teal'}>{names[o.model]}</b><strong>{o.count.toLocaleString('ko-KR')}<small>{o.count===0?'건 기록':'대 기록'}</small></strong></div><p>{o.scope}</p><small>수치 기준 {kst(o.asOf)}<br/>최초 수집 {kst(o.collectedAt)}</small><a href={o.sourceUrl} target="_blank" rel="noreferrer">Robotaxi Tracker · Pioneerlands 공개 집계 ↗</a>{o.count===0&&<p>명부에 해당 차종 0건 · 실제 차량 0대라는 뜻은 아닙니다.</p>}</article>)}</div>}
  {claim&&<details className="fleet-audit alternate-fleet-reference"><summary>다른 출처 참고 · MyCybercab</summary><div className="fleet-records"><article><span className="badge">게시자 주장 · 비공식</span><div><b className="gold">Cybercab · MyCybercab</b><strong>{formatClaimCount(claim)}<small>대 표기</small></strong></div><p>{claimDay(claim.sourceAsOf??claim.asOf)} 기준 · 원문의 + 표기 유지</p><a href={claim.sourceUrl} target="_blank" rel="noreferrer">MyCybercab 원문 ↗</a><p>MyCybercab이 오스틴 카드에 게시한 차량 규모입니다. Tesla 원문 및 도시 전체 배치·영업 대수로 독립 검증되지 않았습니다.</p><p>도시 명부·텍사스 등록 합계·증감 그래프·시장 침투율 계산에 포함하지 않습니다.</p><small>최초 수집 {kst(claim.firstCollectedAt??claim.collectedAt??null)}<br/>최근 수집 성공 {kst(claim.lastSuccessAt??null)}</small>{claim.checkState==='failed'&&<p>최근 수집 실패 · 마지막 정상 표기와 원래 기준일 유지.</p>}</article></div></details>}
  {verification==='verified'&&<p>공식·독립 검증 필터: 비공식 명부 대수는 제외했습니다.</p>}
  {refs.map(r=><details className="fleet-audit regional-reference" key={r.id}><summary>광역 참고값 · 도시 합계 제외</summary><p>{r.scope}</p><strong>Cybercab {r.cybercab.toLocaleString('ko-KR')} · Model Y {r.model_y.toLocaleString('ko-KR')}대 기록</strong><small>{kst(r.asOf)} 기준</small><p>{r.note}</p><a href={r.sourceUrl} target="_blank" rel="noreferrer">광역 명부 원자료 ↗</a></details>)}
  {examples.length>0&&<details className="fleet-audit unverified-reference"><summary>사용자 제공 미검증 참고값 · 합계 제외</summary>{examples.map(o=><p key={o.id}>{names[o.model]} <strong>{o.count.toLocaleString('ko-KR')}대</strong> · 기준일·배정/배치/영업 구분 미확인 <a href={o.sourceUrl} target="_blank" rel="noreferrer">제공된 원문 ↗</a></p>)}<small>원문 요청 403. 확인된 명부와 별도로 보존합니다.</small></details>}
  {sourceRun&&<details className="fleet-audit"><summary>자동 수집 · {sourceRun.state==='ok'?'성공':sourceRun.state==='failed'?'실패 · 마지막 정상값 유지':'재검토 필요'}</summary><p>확인 시도 {kst(sourceRun.checkedAt)}<br/>{sourceRun.message}</p><a href="https://robotaxitracker.com/" target="_blank" rel="noreferrer">Robotaxi Tracker 원사이트 ↗</a></details>}
  {research&&<details className="fleet-audit"><summary>조사한 출처와 미확보 사유</summary><p>{research.reason}</p><small>수동 원문 검토 {kst(research.checkedAt)} · 자동 수집 시도와 별개</small>{research.sources.map(s=><p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a><br/>{s.result}</p>)}</details>}
 </section>;
}
