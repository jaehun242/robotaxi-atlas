export const MODELS = ['cybercab','model_y'];
export const VERIFIED = new Set(['official_single','independent']);
export const kstDay = (date) => new Date(date).toLocaleDateString('en-CA', {timeZone:'Asia/Seoul'});
export function nextUpdate(date = new Date()) {
  const now = new Date(date), day = kstDay(now);
  let next = new Date(`${day}T08:00:00+09:00`);
  if(next <= now) next = new Date(+next + 86400000);
  return next.toISOString();
}
export function validateObservation(o, cities, sources) {
  const errors=[];
  if(typeof o.id!=='string'||!o.id.trim()) errors.push('고유 ID');
  if(!cities.some(c=>c.id===o.city)) errors.push('알 수 없는 도시');
  if(!MODELS.includes(o.model)&&!(o.model==='unspecified'&&o.verification==='unverified'&&o.basis==='unknown')) errors.push('차종');
  if(!['allocated','deployed','testing','commercial','observed'].includes(o.basis)&&!(o.basis==='unknown'&&o.verification==='unverified')) errors.push('집계 기준');
  if(!Number.isSafeInteger(o.count)||o.count<0) errors.push('대수는 0 이상의 정수');
  if(!o.scope?.trim()) errors.push('집계 범위');
  if(!sources.some(s=>s.id===o.sourceId)) errors.push('출처 ID');
  try { const u=new URL(o.sourceUrl); if(u.protocol!=='https:') errors.push('HTTPS 출처'); } catch {errors.push('출처 URL');}
  if(o.asOf && (!Number.isFinite(Date.parse(o.asOf))||!/^\d{4}-\d\d-\d\dT\d\d:\d\d.*(Z|[+-]\d\d:\d\d)$/.test(o.asOf))) errors.push('기준 시각은 시간대가 포함된 ISO 날짜');
  if(!['official_single','independent','unofficial','estimated','unverified','conflict'].includes(o.verification)) errors.push('검증 상태');
  if(o.verification==='independent' && new Set(o.independentGroups??[]).size<2) errors.push('독립된 원출처 그룹 2개 필요');
  if(VERIFIED.has(o.verification)&&!o.asOf) errors.push('확인된 수치에는 기준 시각 필요');
  return errors;
}
export function citiesFor(data, f) {
  return data.cities.filter(c=>{
    const services=data.services.filter(s=>s.city===c.id&&(!f.model||s.model===f.model));
    const matchesStatus=!f.status||(f.status==='unknown'?!services.length||services.some(s=>s.status==='unknown'):services.some(s=>s.status===f.status));
    return (!f.country||c.country===f.country)&&(!f.region||c.region===f.region)&&(!f.city||c.id===f.city)&&matchesStatus;
  });
}
export function latest(data, f, at = '9999-12-31T23:59:59Z') {
  const cities = new Set(citiesFor(data,f).map(c=>c.id));
  const groups=new Map();
  data.observations.filter(o=>cities.has(o.city)&&o.basis===f.basis&&(!f.model||o.model===f.model)&&o.asOf&&Date.parse(o.asOf)<=Date.parse(at)).forEach(o=>{
    const key=`${o.city}|${o.model}`, list=groups.get(key)??[];list.push(o);groups.set(key,list);
  });
  const rows=[];
  for(const list of groups.values()) {
    list.sort((a,b)=>Date.parse(b.asOf)-Date.parse(a.asOf));
    const eligible=list.filter(o=>!['unverified','conflict'].includes(o.verification)&&(f.verification==='all'||VERIFIED.has(o.verification)||(f.verification==='credible'&&o.verification==='unofficial')));
    if(!eligible.length)continue;
    const date=Date.parse(eligible[0].asOf);
    const candidates=list.filter(o=>Date.parse(o.asOf)===date);
    const locked=candidates.find(o=>o.locked&&eligible.includes(o));
    if(locked) { rows.push(locked);continue; }
    // Different definitions or conflicting counts are never resolved with max/average.
    const conflict=new Set(candidates.map(o=>`${o.scope}|${o.count}`)).size>1 || candidates.some(o=>o.verification==='conflict');
    if(!conflict) rows.push(eligible[0]);
  }
  return rows;
}
export function aggregate(rows) {
  const sum=(model)=> {const r=rows.filter(o=>!model||o.model===model);return r.length?r.reduce((s,o)=>s+o.count,0):null;};
  return {total:sum(),cybercab:sum('cybercab'),model_y:sum('model_y'),coverage:rows.length,asOf:rows.length?rows.map(o=>o.asOf).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1):null};
}
export function findConflicts(observations) {
  const groups=new Map();
  for(const o of observations.filter(o=>o.asOf)) {const key=`${o.city}|${o.model}|${o.basis}|${Date.parse(o.asOf)}`;const list=groups.get(key)??[];list.push(o);groups.set(key,list);}
  return [...groups.entries()].filter(([,list])=>list.length>1&&new Set(list.map(o=>`${o.scope}|${o.count}`)).size>1).map(([key,list])=>({key,ids:list.map(o=>o.id),city:list[0].city,model:list[0].model,basis:list[0].basis,asOf:list[0].asOf,resolvedBy:list.find(o=>o.locked)?.id??null,reason:'같은 기준 시각의 출처별 대수 또는 집계 범위가 다름'}));
}
export function comparableDelta(current, previous) {
  const key=o=>`${o.city}|${o.model}|${o.basis}|${o.scope}`;
  if(!current.length||current.length!==previous.length) return null;
  const a=current.map(key).sort().join(';'), b=previous.map(key).sort().join(';');
  if(a!==b) return null;
  // A carried-forward value is not a fresh comparison.
  if(current.some(o=>previous.some(p=>key(p)===key(o)&&Date.parse(p.asOf)===Date.parse(o.asOf)))) return null;
  return current.reduce((n,o)=>n+o.count,0)-previous.reduce((n,o)=>n+o.count,0);
}
export function history(data,f,days, now=new Date()) {
  const candidates=data.observations.filter(o=>o.asOf);
  const earliest=candidates.map(o=>kstDay(o.asOf)).sort()[0]??kstDay(now);
  const start=days==='all'?earliest:kstDay(new Date(+now-(Number(days)-1)*86400000));
  const end=kstDay(now);const rows=[];
  for(let day=new Date(`${start}T00:00:00Z`);day.toISOString().slice(0,10)<=end;day=new Date(+day+86400000)) {
    const d=day.toISOString().slice(0,10), at=new Date(`${d}T23:59:59+09:00`).toISOString();
    const all=latest(data,f,at);
    const exact=all.filter(o=>kstDay(o.asOf)===d);
    const previous=rows.at(-1);
    const sameScope=exact.length>0&&(!previous||previous.records.length===0||exact.map(o=>`${o.city}|${o.model}|${o.scope}`).sort().join()===previous.records.map(o=>`${o.city}|${o.model}|${o.scope}`).sort().join());
    rows.push({day:d,...aggregate(exact), delta:previous?comparableDelta(exact,previous.records):null,records:exact,scopeChanged:!sameScope,carried:aggregate(all)});
  }
  return rows;
}
export function ingest(data, incoming, now) {
  const next=structuredClone(data);
  for(const record of incoming) {
    const errors=validateObservation(record,next.cities,next.sources);
    if(errors.length) throw new Error(`${record.id}: ${errors.join(', ')}`);
    const i=next.observations.findIndex(o=>o.id===record.id);
    if(i<0) {next.observations.push(record);continue;}
    const old=next.observations[i];
    if(old.locked&&!record.locked) continue;
    if(JSON.stringify({...old,collectedAt:null})===JSON.stringify({...record,collectedAt:null})) continue;
    next.revisions.push({id:record.id,changedAt:now,previous:old,replacement:record});
    next.observations[i]={...record,collectedAt:old.collectedAt};
  }
  return next;
}
