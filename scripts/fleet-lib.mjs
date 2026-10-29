import {boundedFetch} from './statistics-lib.mjs';
import {ingest,kstDay} from '../src/domain.mjs';
export const FLEET_URL='https://pioneerlands.org/cybercabtracker';
const AREA_CITY={Austin:'austin',Dallas:'dallas',Houston:'houston',Miami:'miami',Orlando:'orlando',Tampa:'tampa'};
export function parseFleetSnapshot(rows,runs,now){
  if(!Array.isArray(rows)||!Array.isArray(runs)||!runs.length)throw Error('공개 집계 구조 변경');
  const sourceAt=runs.find(r=>r.ok===true)?.ran_at;
  if(!sourceAt||!Number.isFinite(Date.parse(sourceAt))||Date.parse(sourceAt)>Date.parse(now)+300000)throw Error('미러 기준 시각 검증 실패');
  const seen=new Set();
  const clean=rows.map(r=>{
    if(typeof r.city!=='string'||seen.has(r.city)||!Number.isSafeInteger(r.total)||!Number.isSafeInteger(r.cybercab)||r.cybercab<0||r.total<r.cybercab||!r.newest||!Number.isFinite(Date.parse(r.newest)))throw Error('지역·차종 집계 검증 실패');
    seen.add(r.city);return {...r,model_y:r.total-r.cybercab};
  });
  if(!clean.some(r=>r.city==='Austin')||!clean.some(r=>r.city==='Dallas'))throw Error('주요 지역 누락. 기존 자료 보존');
  return {rows:clean,sourceAt:new Date(sourceAt).toISOString()};
}
export async function fetchFleetSnapshot(fetcher=fetch,now=new Date().toISOString()){
  const html=await(await boundedFetch(FLEET_URL,fetcher)).text();
  const path=html.match(/<script[^>]*src="(\/assets\/index-[a-zA-Z0-9_-]+\.js)"/)?.[1];
  if(!path)throw Error('공개 집계 진입 파일 변경');
  const js=await(await boundedFetch('https://pioneerlands.org'+path,fetcher)).text();
  const host=js.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
  // This is the publisher's public anonymous read client, discovered in memory.
  // Never persist/log its key or request headers, and never query individual vehicles.
  const key=[...js.matchAll(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g)].map(m=>m[0]).find(k=>{try{return JSON.parse(Buffer.from(k.split('.')[1],'base64url')).role==='anon';}catch{return false;}});
  if(!host||!key)throw Error('공개 익명 읽기 설정 변경');
  const get=path=>boundedFetch(host+'/rest/v1/'+path,(url,options)=>fetcher(url,{...options,headers:{...options.headers,apikey:key,Authorization:'Bearer '+key}})).then(r=>r.json());
  const rows=await get('cybercab_fleet_by_area?select=city,total,cybercab,new_24h,new_7d,newest');
  const runs=await get('cybercab_scrape_runs?select=ran_at,ok&ok=eq.true&order=ran_at.desc&limit=2');
  return parseFleetSnapshot(rows,runs,now);
}
export async function collectFleet(data,{now=new Date().toISOString(),fetcher=fetch,forceFailure=false}={}){
  let next=structuredClone(data);const id='pioneer-tracker';
  // This publisher exposes aggregate mirror rows; it is not a route around the
  // original site's app-only endpoints or a guarantee of identical live filters.
  const source={id,name:'Robotaxi Tracker · Pioneerlands 공개 집계 미러',url:FLEET_URL,priority:3,access:'public aggregate mirror',definition:'원자료 Robotaxi Tracker / Ethan McKanna. Pioneerlands의 지역별 커뮤니티 추적 명부 미러이며 공식 등록·실제 영업 대수가 아님. 원본 in service 화면과 필터·수집 시각이 다를 수 있음. Model Y=미러 전체−Cybercab.',automation:'공개 미러의 지역별 집계만 수집 · 원본 자동 접근 403은 우회하지 않음 · 실패 시 마지막 확인값 유지'};
  const sourceIndex=next.sources.findIndex(s=>s.id===id);
  if(sourceIndex<0)next.sources.push(source);else next.sources[sourceIndex]={...next.sources[sourceIndex],...source};
  const prior=next.sourceRuns.find(s=>s.sourceId===id);
  let run={sourceId:id,state:'failed',checkedAt:now,lastSuccessAt:prior?.lastSuccessAt??null,message:''};
  try{
    if(forceFailure)throw Error('실패 보존 검증용 강제 실패');
    const snapshot=await fetchFleetSnapshot(fetcher,now);let changed=0;
    for(const row of snapshot.rows){
      const city=AREA_CITY[row.city]??next.cities.find(c=>c.english.toLowerCase()===row.city.toLowerCase())?.id;
      if(!city){if(!['Bay Area','Unassigned'].includes(row.city)){next.regionCandidates=next.regionCandidates??[];if(!next.regionCandidates.some(c=>c.name===row.city))next.regionCandidates.push({name:row.city,firstCollectedAt:now,sourceUrl:FLEET_URL,status:'needs_geography_review',reason:'커뮤니티 명부의 새 지역명. 국가·행정구역·좌표 검증 후 지도 추가.'});}continue;}
      for(const model of ['cybercab','model_y']){
        const count=row[model];
        const previous=next.observations.filter(o=>o.sourceId===id&&o.city===city&&o.model===model).sort((a,b)=>Date.parse(b.asOf)-Date.parse(a.asOf))[0];
        // A new source-check clock alone is not a new numeric observation.
        if(previous?.count===count)continue;
        const record={id:`pioneer-${city}-${model}-${kstDay(snapshot.sourceAt)}`,city,model,basis:'observed',count,asOf:snapshot.sourceAt,collectedAt:now,sourceId:id,sourceUrl:FLEET_URL,scope:`Robotaxi Tracker 지역명 ${row.city}의 커뮤니티 명부 (행정경계·당일 가동 미검증)`,scopeId:`tracker:area:${row.city.toLowerCase()}`,vehicleDefinition:'community_registry',coverageComplete:false,verification:'unofficial',discoveryThrough:row.newest,note:`원자료 Robotaxi Tracker / Ethan McKanna (https://robotaxitracker.com/)를 Pioneerlands가 집계한 공개 미러 명부. 원본 in service 화면과 필터·시각이 다를 수 있음. 최근 신규 발견 ${row.newest}. 0은 명부 기록 0건이며 실제 차량 0대가 아님. Model Y는 같은 명부의 전체−Cybercab. 배치·영업 대수로 해석하지 않음.`};
        next=ingest(next,[record],now);changed++;
      }
    }
    const bay=snapshot.rows.find(r=>r.city==='Bay Area');
    if(bay){const previous=next.fleetReferences?.find(r=>r.id==='pioneer-bay-area');const reference={id:'pioneer-bay-area',city:'san-francisco',scope:'Bay Area 전체 커뮤니티 명부 · 샌프란시스코시와 다름',cybercab:bay.cybercab,model_y:bay.model_y,asOf:snapshot.sourceAt,collectedAt:previous?.collectedAt??now,sourceUrl:FLEET_URL,note:'광역권 참고값. 샌프란시스코 도시 합계·비율·증감에서 제외. 0은 명부 기록 0건.'};
      if(previous&&previous.cybercab===reference.cybercab&&previous.model_y===reference.model_y)reference.asOf=previous.asOf;
      next.fleetReferences=[...(next.fleetReferences??[]).filter(r=>r.id!==reference.id),reference];
    }
    const missing=Object.keys(AREA_CITY).filter(area=>!snapshot.rows.some(r=>r.city===area));
    run={...run,state:missing.length?'changed':'ok',lastSuccessAt:now,sourceSnapshotAt:snapshot.sourceAt,message:`Robotaxi Tracker 공개 미러 집계 성공 · ${changed}개 수치 신규/변경. 원자료 미러 시각 ${snapshot.sourceAt}. 배치·영업 대수 아님.${missing.length?' 누락 지역 이전 값 유지: '+missing.join(', '):''}`};
  }catch(e){run.message=`${e.message}. 마지막 정상 명부와 원래 수치 기준일 보존.`;}
  next.sourceRuns=[...next.sourceRuns.filter(s=>s.sourceId!==id),run];
  if(run.state==='ok'){next.lastSuccessAt=now;const daily=next.runs.find(r=>r.id===`daily-${kstDay(now)}`);if(daily?.state==='failed')daily.state='partial';}
  if(run.state==='failed'){const daily=next.runs.find(r=>r.id===`daily-${kstDay(now)}`);if(daily?.state==='success')daily.state='partial';}
  return next;
}
