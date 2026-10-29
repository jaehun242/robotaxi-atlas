import {ArrowUpRight} from 'lucide-react';
import type {Dataset,Filters,City} from './types';
import type {MonitoringDataset} from './monitoring-types';
import {latest} from './domain.mjs';
import {US_REGIONS} from './us-regions';
export default function USCityExplorer({data,monitoring,filters,onCity,onRegion,onCoverage}:{data:Dataset;monitoring:MonitoringDataset|null;filters:Filters;onCity:(city:City)=>void;onRegion:(code:string)=>void;onCoverage:()=>void}){
 const rows=latest(data,{country:'US',region:'',city:'',model:'',basis:'observed',status:'',verification:'credible'}),countCities=new Set(rows.map(r=>r.city)).size;
 const states=[...new Map(data.cities.map(c=>[c.region,c.regionName])).entries()];
 const numericStates=monitoring?.summary.numericParsers??null;
 return <section className="us-city-explorer" aria-label="미국 전역 도시 탐색"><div className="us-explorer-heading"><div><span className="us-scope-badge">UNITED STATES</span><h2>미국 전역</h2></div><div className="us-explorer-actions"><select aria-label="미국 주 바로가기" value={filters.region} onChange={e=>onRegion(e.target.value)}><option value="">미국 전체 · 50주 + D.C.</option>{US_REGIONS.map(r=><option key={r.code} value={r.code}>{r.code} · {data.cities.find(c=>c.region===r.code)?.regionName??r.name}</option>)}</select><button onClick={onCoverage} aria-label="미국 수집 범위 보기"><ArrowUpRight size={17}/></button></div></div><p className="us-coverage-caption">관측 도시 <b>{data.cities.length}</b> · 도시 명부 확보 <b>{countCities}곳</b> · 공식 등록 대수 연결 <b>{numericStates===null?'미확인':numericStates+'개 주'}</b></p><div className="us-city-groups">{states.map(([code,name])=><div key={code}><span>{name}</span><div>{data.cities.filter(c=>c.region===code).map(c=><button key={c.id} aria-pressed={filters.city===c.id} className={filters.city===c.id?'active':''} onClick={()=>onCity(c)}>{c.name}</button>)}</div></div>)}</div></section>;
}
export function USRegionReferences({data,filters}:{data:Dataset;filters:Filters}){
 if(filters.verification==='verified'||filters.basis!=='observed')return null;
 const references=data.fleetReferences?.filter(r=>!filters.region||data.cities.find(c=>c.id===r.city)?.region===filters.region)??[];
 if(!references.length)return null;
 return <div className="us-region-references">{references.map(r=><details key={r.id}><summary><span>{r.id==='pioneer-bay-area'?'베이 에어리어 · 광역권 참고':r.scope}</span><b>{filters.model==='cybercab'?'Cybercab':'Model Y'} {(filters.model==='cybercab'?r.cybercab:r.model_y).toLocaleString()}대</b><small>비공식 명부 · 도시 합계 제외</small></summary><p>{r.scope}. {r.note}</p><p>Cybercab {r.cybercab} / Model Y {r.model_y.toLocaleString()} · 기준 {new Date(r.asOf).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST</p><a href={r.sourceUrl} target="_blank" rel="noreferrer">명부 원문 ↗</a></details>)}</div>;
}
