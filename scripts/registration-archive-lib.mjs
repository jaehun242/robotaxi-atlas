export const ARCHIVE_URL='https://fsddb.com/robotaxi?operator=tesla-robotaxi-llc';
const validDay=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function parseRegistrationArchive(data,operator){
 const h=data.fleet_history,series=h?.series?.filter(s=>String(s.operator_id)===String(operator.id));
 if(!Array.isArray(h?.dates)||!h.dates.length||h.dates.length>5000||series?.length!==1||!Array.isArray(series[0].data)||series[0].data.length!==h.dates.length)throw Error('과거 등록 시계열 구조·사업자 범위 검증 실패');
 const dates=new Set();const points=h.dates.map((date,i)=>{
  const total=series[0].data[i];if(!validDay(date)||dates.has(date)||total!==null&&(!Number.isSafeInteger(total)||total<0))throw Error('과거 등록 날짜·대수 검증 실패');
  dates.add(date);return {date,total,cybercab:null,model_y:null};
 }).sort((a,b)=>a.date.localeCompare(b.date));
 if(!points.some(p=>p.total!==null))throw Error('과거 등록 수치 미확보');
 return {sourceId:'fsddb-tesla-registration-history',publisher:'FSD Database',sourceUrl:ARCHIVE_URL,scopeId:'us:state:TX:tesla:registered',basis:'registered',verification:'unofficial',dateBasis:'publisher_calendar',timezone:null,sourceAsOf:data.generated_at??operator.last_synced_at??null,definition:'FSD Database가 TxDMV 동기화별 일일 등록 총계로 공개한 이력. 과거 차종 구분·날짜의 시간대는 미공개. 직접 수집한 KST 시각의 공식 스냅샷과 별개.',points};
}
export function mergeRegistrationArchive(prior,incoming,now,error){
 if(!incoming)return {...(prior??{points:[],revisions:[]}),lastCheckedAt:now,checkState:'failed',error:error??'과거 자료 미확보 · 마지막 정상 자료 보존'};
 const points=new Map((prior?.points??[]).map(p=>[p.date,p])),revisions=[...(prior?.revisions??[])];let changed=false;
 for(const p of incoming.points){
  const old=points.get(p.date);
  if(old&&old.total!==p.total)revisions.push({date:p.date,previous:old.total,replacement:p.total,changedAt:now,sourceAsOf:incoming.sourceAsOf});
  if(!old||old.total!==p.total)changed=true;
  points.set(p.date,{...p,firstCollectedAt:old?.firstCollectedAt??now,lastCheckedAt:now});
 }
 return {...incoming,points:[...points.values()].sort((a,b)=>a.date.localeCompare(b.date)),firstCollectedAt:prior?.firstCollectedAt??now,updatedAt:changed||!prior?now:prior.updatedAt,lastCheckedAt:now,lastSuccessAt:now,checkState:'ok',error:null,revisions};
}
