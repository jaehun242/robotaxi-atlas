import {boundedFetch} from './statistics-lib.mjs';
import {createHash} from 'node:crypto';
export const SAFETY_URL='https://www.tesla.com/robotaxi/safety';
export function parseSafetyPlans(html){
 const embedded=html.match(/<script\b(?=[^>]*data-info=["']react-data-tesla_robotaxi_graph_1["'])[^>]*>([\s\S]*?)<\/script>/i)?.[1];
 if(!embedded)throw Error('공식 안전 페이지 JSON 구조 변경');
 const data=JSON.parse(embedded).data;
 if(!Array.isArray(data?.comingSoonCities)||data.comingSoonCities.some(c=>typeof c.t_name!=='string'))throw Error('공식 Coming Soon 목록 구조 변경');
 return {names:data.comingSoonCities.map(c=>c.t_name),graphBasis:data.t_totalNote??null};
}
const normal=s=>s.toLowerCase().replace(/[.,]/g,'').replace(/\s+/g,' ').trim();
export async function collectSafety(data,catalog,{fetcher=fetch,now=new Date().toISOString(),forceFailure=false}={}){
 const next=structuredClone(data),id='tesla-safety';
 if(!next.sources.some(s=>s.id===id))next.sources.push({id,name:'Tesla 공식 안전 보고·진출 계획',url:SAFETY_URL,priority:1,access:'public embedded JSON',definition:'Coming Soon은 계획 발표. 주행거리를 차량 대수로 변환하지 않음.',automation:'공개 JSON 계획 목록 수집 · 검증한 지리 사전과 일치할 때 지도 추가'});
 const prior=next.sourceRuns.find(s=>s.sourceId===id);let run={sourceId:id,state:'failed',checkedAt:now,lastSuccessAt:prior?.lastSuccessAt??null,message:''};
 try{
  if(forceFailure)throw Error('안전 페이지 실패 모의');const response=await boundedFetch(SAFETY_URL,fetcher);const plans=parseSafetyPlans(await response.text());const normalized=new Set(plans.names.map(normal));let added=0;
  for(const location of catalog.regions){
   if(!location.discoveryNames.some(n=>normalized.has(normal(n))))continue;
   if(!next.cities.some(c=>c.id===location.id)){const {id,name,english,country,countryName,region,regionName,coordinates}=location;next.cities.push({id,name,english,country,countryName,region,regionName,coordinates});added++;}
   const serviceId='tesla-safety-plan-'+location.id,old=next.services.find(s=>s.id===serviceId);
   if(!old)next.services.push({id:serviceId,city:location.id,model:'unspecified',status:'planned',safety:'unknown',paid:false,asOf:null,observedAt:now,sourceId:id,sourceUrl:SAFETY_URL,verification:'official_single',note:'Tesla 공식 Coming Soon에 명시. 차종·차량 수·개시일·서비스 경계 미공개. 지도는 Census 도시 대표점이며 계획의 광역권 경계가 아님.'});
   else old.lastCheckedAt=now;
   if(!next.news.some(n=>n.id===serviceId))next.news.push({id:serviceId,city:location.id,model:'unspecified',title:location.name+' · Tesla 공식 진출 계획 목록 확인',summary:'공식 Coming Soon 목록. 실제 영업 개시·배치 차량 수는 미확인입니다. 게시일·사건 날짜는 공개되지 않았습니다.',eventDate:null,publishedAt:null,firstCollectedAt:now,sourceId:id,sourceUrl:SAFETY_URL});
   for(const fact of location.additionalEvidence??[]){const newsId=serviceId+'-'+fact.type;if(!next.news.some(n=>n.id===newsId))next.news.push({id:newsId,city:location.id,model:'unspecified',title:location.name+' · 관할 기관 발표',summary:fact.note,eventDate:fact.asOf??null,publishedAt:fact.publishedAt??null,firstCollectedAt:now,sourceId:id,sourceUrl:fact.sourceUrl});}
  }
  const matched=new Set(catalog.regions.flatMap(l=>l.discoveryNames.map(normal)));next.regionCandidates=next.regionCandidates??[];
  for(const name of plans.names.filter(n=>!matched.has(normal(n))))if(!next.regionCandidates.some(r=>r.name===name))next.regionCandidates.push({name,sourceUrl:SAFETY_URL,firstCollectedAt:now,status:'needs_geography_review',reason:'공식 계획 목록에서 발견했으나 지리 식별을 검증하지 못해 지도 자동 배정을 보류.'});
  run={...run,state:'ok',lastSuccessAt:now,contentHash:createHash('sha256').update(JSON.stringify(plans.names)).digest('hex'),message:`공식 진출 계획 ${plans.names.length}개 확인 · 새 지도 지역 ${added}개. 차량 수·영업으로 확대 해석하지 않음. 게시일 미공개.`};
 }catch(e){run.message=e.message+' · 기존 계획·지도·최초 확인일 보존';}
 next.sourceRuns=[...next.sourceRuns.filter(r=>r.sourceId!==id),run];return next;
}
