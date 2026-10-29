import {ArrowUpRight} from 'lucide-react';
import type {Dataset,Filters,City,Observation,Status} from './types';
import type {MonitoringDataset} from './monitoring-types';
import {citiesFor,latest} from './domain.mjs';
import {US_REGIONS} from './us-regions';

const modelNames={cybercab:'Cybercab',model_y:'Model Y'} as const;
const statusNames:Record<Status,string>={commercial:'상업운행',limited:'제한 서비스',testing:'시험운행',preparing:'배치 준비',planned:'계획 발표',suspended:'운영 중단',unknown:'미확인'};
const basisNames={allocated:'배정',deployed:'현지 배치',testing:'시험운행',commercial:'상업운행',observed:'추적 명부'} as const;

function countText(row:Observation|undefined,basis:Filters['basis']){
 if(!row)return '—';
 return row.count===0&&basis==='observed'?'0건':row.count.toLocaleString('ko-KR')+'대';
}

function countDescription(row:Observation|undefined,model:'cybercab'|'model_y',basis:Filters['basis']){
 if(!row)return modelNames[model]+': 확인할 수 없음';
 const description=modelNames[model]+': '+countText(row,basis)+' · '+basisNames[basis];
 const scope=row.count===0&&basis==='observed'?' · 명부에서 확인된 기록이 없으며 실제 차량 0대를 뜻하지 않습니다':'';
 const day=row.asOf?' · 기준 '+new Date(row.asOf).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'';
 return description+scope+day;
}

function serviceStatus(data:Dataset,city:City,filters:Filters){
 const services=data.services.filter(s=>s.city===city.id&&(!filters.model||s.model===filters.model));
 const specific=services.filter(s=>s.model!=='unspecified');
 const rows=specific.length?specific:services;
 const statuses=[...new Set(rows.map(s=>s.status))];
 const value=statuses.length===1?statuses[0]:'unknown';
 const label=statuses.length>1?'차종별 상이':specific.length===1?modelNames[specific[0].model as 'cybercab'|'model_y']+' · '+statusNames[value]:statusNames[value];
 const details=rows.map(s=>(s.model==='unspecified'?'차종 미구분':modelNames[s.model])+': '+statusNames[s.status]).join(' / ');
 return {value,label,details:details||'서비스 상태를 확인할 수 없음'};
}

export default function USCityExplorer({data,filters,onCity,onRegion,onCoverage}:{data:Dataset;monitoring:MonitoringDataset|null;filters:Filters;onCity:(city:City)=>void;onRegion:(code:string)=>void;onCoverage:()=>void}){
 // A selected city stays highlighted while its neighboring cities remain available.
 const directoryFilters={...filters,country:'US',city:''};
 const cities=citiesFor(data,directoryFilters);
 const rows=latest(data,directoryFilters);
 const models=(['cybercab','model_y'] as const).filter(model=>!filters.model||filters.model===model);
 const subtitle=basisNames[filters.basis]+' · '+(filters.verification==='verified'?'공식 확인':filters.basis==='observed'?'비공식':'선택한 검증 기준');
 return <section className="tracker-city-directory" aria-label="미국 도시별 차량 현황">
  <div className="directory-heading">
   <div><h2>도시별 현황</h2><p>{subtitle}</p></div>
   <button type="button" className="directory-coverage" onClick={onCoverage} aria-label="미국 수집 범위와 출처 보기" title="수집 범위와 출처" style={{minWidth:44,minHeight:44}}><ArrowUpRight size={17}/></button>
  </div>
  <div className="directory-actions">
   <select aria-label="미국 주 바로가기" value={filters.region} onChange={e=>onRegion(e.target.value)} style={{minHeight:44}}>
    <option value="">미국 전체</option>
    {US_REGIONS.map(r=><option key={r.code} value={r.code}>{r.code} · {data.cities.find(c=>c.country==='US'&&c.region===r.code)?.regionName??r.name}</option>)}
   </select>
   <button type="button" className="directory-reset" onClick={()=>onRegion('')} style={{minHeight:44}}>전체보기</button>
  </div>
  <div className="directory-list" aria-label="도시 목록">
   {cities.map(city=>{
    const status=serviceStatus(data,city,filters);
    const selected=filters.city===city.id;
    return <button type="button" key={city.id} className={'directory-city'+(selected?' active':'')} aria-pressed={selected} aria-label={city.name+' '+city.region+' · '+models.map(model=>countDescription(rows.find(row=>row.city===city.id&&row.model===model),model,filters.basis)).join(' / ')+' · '+status.details} onClick={()=>onCity(city)} style={{minHeight:44}}>
     <span className="directory-name"><strong>{city.name}</strong><small>{city.region}</small></span>
     <span className="directory-counts">{models.map(model=>{
      const row=rows.find(item=>item.city===city.id&&item.model===model);
      return <span key={model} className={'directory-count '+(model==='cybercab'?'gold':'teal')} title={countDescription(row,model,filters.basis)}><small>{modelNames[model]}</small><b>{countText(row,filters.basis)}</b></span>;
     })}</span>
     <span className={'directory-status '+status.value} title={status.details}>{status.label}</span>
    </button>;
   })}
   {!cities.length&&<p className="directory-empty">이 조건에 해당하는 추적 도시가 없습니다.</p>}
  </div>
 </section>;
}
export function USRegionReferences({data,filters}:{data:Dataset;filters:Filters}){
 if(filters.verification==='verified'||filters.basis!=='observed')return null;
 const references=data.fleetReferences?.filter(r=>!filters.region||data.cities.find(c=>c.id===r.city)?.region===filters.region)??[];
 if(!references.length)return null;
 return <div className="us-region-references">{references.map(r=><details key={r.id}><summary><span>{r.id==='pioneer-bay-area'?'베이 에어리어 · 광역권 참고':r.scope}</span><b>{filters.model==='cybercab'?'Cybercab':'Model Y'} {(filters.model==='cybercab'?r.cybercab:r.model_y).toLocaleString()}대</b><small>비공식 명부 · 도시 합계 제외</small></summary><p>{r.scope}. {r.note}</p><p>Cybercab {r.cybercab} / Model Y {r.model_y.toLocaleString()} · 기준 {new Date(r.asOf).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST</p><a href={r.sourceUrl} target="_blank" rel="noreferrer">명부 원문 ↗</a></details>)}</div>;
}
