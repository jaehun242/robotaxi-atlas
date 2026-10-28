import {kstDay,citiesFor,findConflicts} from './domain.mjs';
const models=['cybercab','model_y'];
const dayGap=(a,b)=>Math.round((Date.parse(kstDay(b)+'T00:00:00Z')-Date.parse(kstDay(a)+'T00:00:00Z'))/86400000);
const valid=r=>r&&Number.isFinite(Date.parse(r.checkedAt))&&[r.total,r.cybercab,r.model_y,r.unknown??0].every(n=>Number.isSafeInteger(n)&&n>=0)&&r.total===r.cybercab+r.model_y+(r.unknown??0);
const sameScope=(a,b)=>a.sourceId===b.sourceId&&a.scopeId===b.scopeId&&a.basis===b.basis;
export function appendRegistrationHistory(history=[],registry,checkedAt,{evidenceUrl}={}){
 if(registry?.id!=='tx-tesla-official'||registry.checkState!=='ok')return history;
 const row={id:'tx-registry-'+checkedAt,sourceId:registry.id,scopeId:'us:state:TX:tesla:registered',basis:'registered',checkedAt,lastCheckedAt:checkedAt,valueAsOf:registry.asOf,sourceUrl:registry.sourceUrl,total:registry.total,cybercab:registry.cybercab,model_y:registry.model_y,unknown:registry.unknown??0,...(evidenceUrl?{evidenceUrl}:{})};
 if(!valid(row))throw Error('등록 이력의 날짜·차종 합계 검증 실패');
 const rows=history.filter(valid).map(r=>({...r})).sort((a,b)=>Date.parse(a.checkedAt)-Date.parse(b.checkedAt));
 const duplicate=rows.find(r=>r.id===row.id);if(duplicate){Object.assign(duplicate,row);return rows;}
 const last=rows.at(-1);
 if(last&&sameScope(last,row)&&kstDay(last.checkedAt)===kstDay(row.checkedAt)&&['total',...models,'unknown'].every(k=>last[k]===row[k])&&Date.parse(row.checkedAt)>=Date.parse(last.checkedAt)){
  last.lastCheckedAt=row.checkedAt;return rows;
 }
 return [...rows,row].sort((a,b)=>Date.parse(a.checkedAt)-Date.parse(b.checkedAt));
}
export function registrationDailyChanges(history=[]){
 const days=new Map();for(const row of history.filter(valid).sort((a,b)=>Date.parse(a.checkedAt)-Date.parse(b.checkedAt)))days.set(kstDay(row.checkedAt),row);
 const rows=[...days.entries()].sort(([a],[b])=>a.localeCompare(b));
 return rows.map(([day,row],i)=>{const prev=rows[i-1]?.[1],comparable=prev&&sameScope(prev,row);return {...row,day,previousDay:comparable?kstDay(prev.checkedAt):null,gapDays:comparable?dayGap(prev.checkedAt,row.checkedAt):null,deltaCybercab:comparable?row.cybercab-prev.cybercab:null,deltaModelY:comparable?row.model_y-prev.model_y:null,deltaTotal:comparable?row.total-prev.total:null};});
}
export function registrationChangeEvents(history=[]){
 const rows=history.filter(valid).sort((a,b)=>Date.parse(a.checkedAt)-Date.parse(b.checkedAt)),out=[];
 for(let i=1;i<rows.length;i++){const row=rows[i],prev=rows[i-1];if(!sameScope(prev,row))continue;
  for(const model of models)if(row[model]!==prev[model])out.push({id:row.id+'-'+model,model,before:prev[model],after:row[model],delta:row[model]-prev[model],checkedAt:row.checkedAt,previousAt:prev.checkedAt,gapDays:dayGap(prev.checkedAt,row.checkedAt),sourceUrl:row.sourceUrl,evidenceUrl:row.evidenceUrl});
 }return out;
}
export function cityChangeEvents(data,filters){
 const allowed=new Set(citiesFor(data,filters).map(c=>c.id));
 // Keep superseded intraday snapshots; same-time corrections replace their old value.
 const observations=new Map();for(const o of [...(data.revisions??[]).map(r=>r.previous),...data.observations])if(o?.asOf)observations.set(o.id+'|'+o.asOf,o);
 const levels=['official_single','independent',...(filters.verification==='verified'?[]:['unofficial']),...(filters.verification==='all'?['estimated']:[])];
 const candidates=[...observations.values()].filter(o=>levels.includes(o.verification));
 const conflicts=new Set(findConflicts(candidates).filter(c=>!c.resolvedBy).flatMap(c=>c.ids));
 const groups=new Map();
 for(const o of candidates){
  if(o.basis!=='observed'||!models.includes(o.model)||!allowed.has(o.city)||filters.model&&filters.model!==o.model||conflicts.has(o.id)||!Number.isFinite(Date.parse(o.asOf)))continue;
  const key=[o.city,o.model,o.basis,o.sourceId,o.scopeId??o.scope,o.vehicleDefinition??''].join('|');const group=groups.get(key)??[];group.push(o);groups.set(key,group);
 }
 const out=[];for(const rows of groups.values()){rows.sort((a,b)=>Date.parse(a.asOf)-Date.parse(b.asOf));for(let i=1;i<rows.length;i++){const row=rows[i],prev=rows[i-1];if(row.count===prev.count||row.asOf===prev.asOf)continue;out.push({id:row.id+'|'+row.asOf,city:row.city,model:row.model,before:prev.count,after:row.count,delta:row.count-prev.count,checkedAt:row.asOf,previousAt:prev.asOf,gapDays:dayGap(prev.asOf,row.asOf),sourceUrl:row.sourceUrl,verification:row.verification});}}
 return out.sort((a,b)=>Date.parse(b.checkedAt)-Date.parse(a.checkedAt));
}
