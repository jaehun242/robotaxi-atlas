const SOURCE_ID='mycybercab-austin';
const allowedViews=new Set(['credible','all']);
const validCount=value=>Number.isSafeInteger(value)&&value>=0;
const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):0;
const sourceDay=claim=>claim.sourceAsOf??claim.asOf??'';
const checkedAt=claim=>claim.lastSuccessAt??claim.lastCheckedAt??claim.collectedAt??claim.observedAt??'';
const signature=claim=>[claim.count,claim.countQualifier,claim.sourceUrl].join('|');

// Robotaxi Tracker's city roster is now the primary presentation source.
// Keep other publishers available as dated references without replacing city
// observations, aggregates, history or market comparisons.
/** @returns {import('./types').CityFleetClaim | null} */
export function preferredCityClaim(_data,_filters,_city,_model){
 return null;
}

export function alternateCityClaim(data,filters,city,model){
 const cityId=typeof city==='string'?city:city?.id;
 if(!data||!filters||filters.basis!=='observed'||!allowedViews.has(filters.verification)
   ||cityId!=='austin'||model!=='cybercab'
   ||filters.model&&filters.model!==model
   ||filters.city&&filters.city!==cityId
   ||filters.country&&filters.country!=='US'
   ||filters.region&&filters.region!=='TX'
   ||data.demo===true||data.sources?.some(source=>source.id==='demo'))return null;
 const candidates=(data.cityFleetClaims??[]).filter(claim=>{
  if(claim.sourceId!==SOURCE_ID||claim.city!==cityId||claim.model!==model
    ||claim.basis!=='reported_fleet'||claim.verification!=='unofficial'
    ||!validCount(claim.count)||!['at_least','exact'].includes(claim.countQualifier))return false;
  try{return new URL(claim.sourceUrl).protocol==='https:';}catch{return false;}
 }).slice().sort((a,b)=>time(sourceDay(b))-time(sourceDay(a))||time(checkedAt(b))-time(checkedAt(a)));
 if(!candidates.length)return null;
 const first=candidates[0];
 const tied=candidates.filter(c=>time(sourceDay(c))===time(sourceDay(first))&&time(checkedAt(c))===time(checkedAt(first)));
 if(new Set(tied.map(signature)).size>1)return null;
 return first;
}

export function formatClaimCount(claim){
 if(!claim||!validCount(claim.count)||!['at_least','exact'].includes(claim.countQualifier))return '—';
 return claim.count.toLocaleString('ko-KR')+(claim.countQualifier==='at_least'?'+':'');
}
