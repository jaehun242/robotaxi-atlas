import {kstDay} from './domain.mjs';

const FIRST_DAY='2026-06-09';
const DAY_MS=86400000;
const allowedVerifications=new Set(['official_single','unofficial','independent']);
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const validCount=value=>Number.isSafeInteger(value)&&value>=0;
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
const observationTimestamp=value=>typeof value==='string'&&/T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)?timestamp(value):null;
const previousDay=day=>new Date(Date.parse(day+'T00:00:00Z')-DAY_MS).toISOString().slice(0,10);
const official=c=>c.verification==='official_single';
const hasModel=c=>c.cybercab!==null||c.model_y!==null;
const complete=c=>c.cybercab!==null&&c.model_y!==null;
const tier=c=>official(c)?0:c.observedAt!==null?1:2;
const dateOnlyPriority=c=>c.sourceId==='tslafg'?0:1;
const eligibility=c=>allowedVerifications.has(c.verification)&&hasModel(c)&&!c.invalidPartition;

// This chooses one observation, never the maximum model count or an average.
// Direct official observations win even when an unofficial same-day read is later.
// Otherwise actual observations are ordered by time; date-only publisher records
// follow. Completeness breaks an otherwise equal observation rank only.
function compare(a,b){
 const rank=tier(a)-tier(b);
 if(rank)return rank;
 if(a.observedAt!==null&&b.observedAt!==null){
  const elapsed=Date.parse(b.observedAt)-Date.parse(a.observedAt);
  if(elapsed)return elapsed;
 }
 if(complete(a)!==complete(b))return complete(a)?-1:1;
 if(a.observedAt===null&&b.observedAt===null){
  const publisher=dateOnlyPriority(a)-dateOnlyPriority(b);
  if(publisher)return publisher;
  const publication=(timestamp(b.publishedAt)??-Infinity)-(timestamp(a.publishedAt)??-Infinity);
  if(Number.isFinite(publication)&&publication!==0)return publication;
  if(timestamp(a.publishedAt)===null&&timestamp(b.publishedAt)!==null)return 1;
  if(timestamp(a.publishedAt)!==null&&timestamp(b.publishedAt)===null)return -1;
 }
 return a.sourceId.localeCompare(b.sourceId)||String(a.observationId??'').localeCompare(String(b.observationId??''))||a.sourceDate.localeCompare(b.sourceDate)||JSON.stringify([a.cybercab,a.model_y,a.total,a.note]).localeCompare(JSON.stringify([b.cybercab,b.model_y,b.total,b.note]));
}
function normalize(source,observation){
 const sourceId=source.sourceId??source.id;
 if(typeof sourceId!=='string'||!validDay(observation?.date))return null;
 if(source.scope&&source.scope!=='US-TX'||source.basis&&source.basis!=='registered')return null;
 const at=observationTimestamp(observation.observedAt);
 // Do not relabel a malformed claimed timestamp as a credible date-only reading.
 if(observation.observedAt!=null&&at===null)return null;
 const observedAt=at===null?null:new Date(at).toISOString();
 const sourceDateBasis=observation.dateBasis??source.dateBasis??'publisher_calendar_timezone_unknown';
 const dateBasis=at===null
  ? sourceDateBasis==='KST_confirmation_day'?'publisher_calendar_timezone_unknown':sourceDateBasis
  : 'KST_confirmation_day';
 const cybercab=validCount(observation.cybercab)?observation.cybercab:null;
 const model_y=validCount(observation.model_y)?observation.model_y:null;
 const reportedTotal=validCount(observation.total)?observation.total:null;
 return {
  day:at===null?observation.date:kstDay(observedAt),
  sourceId,sourceName:source.name??sourceId,
  sourceUrl:observation.sourceUrl??source.url??null,
  verification:source.verification??'unverified',
  dateBasis,sourceDateBasis,sourceDate:observation.date,
  observedAt,publishedAt:observation.publishedAt??null,
  firstCollectedAt:observation.firstCollectedAt??null,
  note:observation.note??'',modelEvidence:observation.modelEvidence??[],
  observationId:observation.id??null,
  cybercab,model_y,total:reportedTotal,
  invalidPartition:cybercab!==null&&model_y!==null&&reportedTotal!==null&&cybercab+model_y!==reportedTotal,
  scope:'US-TX',basis:'registered'
 };
}
function metadata(c){
 const {sourceId,sourceName,sourceUrl,verification,dateBasis,sourceDateBasis,sourceDate,observedAt,publishedAt,firstCollectedAt,note,modelEvidence,scope,basis}=c;
 return {sourceId,sourceName,sourceUrl,verification,dateBasis,sourceDateBasis,sourceDate,observedAt,publishedAt,firstCollectedAt,note,modelEvidence,scope,basis};
}
function select(day,candidates){
 const possible=candidates.filter(eligibility).sort(compare);
 const first=possible[0];
 // Equal-priority reports of the exact same instant that disagree are not
 // resolved through source-ID order. Keep the disputed observation absent.
 const tied=!first?[]:first.observedAt!==null
  ? possible.filter(c=>tier(c)===tier(first)&&c.observedAt===first.observedAt)
  : possible.filter(c=>c.sourceId===first.sourceId&&c.sourceDate===first.sourceDate&&timestamp(c.publishedAt)===timestamp(first.publishedAt));
 const conflict=['cybercab','model_y'].some(field=>new Set(tied.map(c=>c[field]).filter(v=>v!==null)).size>1);
 const selected=first&&!conflict?metadata(first):null;
 const cybercab=selected?first.cybercab:null,model_y=selected?first.model_y:null;
 return {day,cybercab,model_y,total:cybercab!==null&&model_y!==null?cybercab+model_y:null,selected,candidates:[...candidates].sort(compare),conflict,dailyDeltaCybercab:null,dailyDeltaModelY:null};
}
function compatible(left,right){
 return left?.selected&&right?.selected
  &&left.selected.sourceId===right.selected.sourceId
  &&left.selected.dateBasis===right.selected.dateBasis
  &&left.selected.sourceDateBasis===right.selected.sourceDateBasis
  &&left.selected.verification===right.selected.verification
  &&left.selected.scope===right.selected.scope
  &&left.selected.basis===right.selected.basis;
}

export function canonicalModelTimeline(sources,{period='all',end=kstDay(new Date()),verifiedOnly=false}={}){
 if(!validDay(end))throw Error('Canonical model timeline requires a YYYY-MM-DD end date');
 if(period!=='all'&&(!Number.isSafeInteger(Number(period))||Number(period)<1))throw Error('Canonical model timeline period must be all or a positive day count');
 const byDay=new Map();
 for(const source of sources??[])for(const observation of source.observations??[]){
  const candidate=normalize(source,observation);
  if(!candidate||candidate.day<FIRST_DAY||candidate.day>end||verifiedOnly&&!official(candidate))continue;
  const list=byDay.get(candidate.day)??[];list.push(candidate);byDay.set(candidate.day,list);
 }
 const points=new Map([...byDay].map(([day,candidates])=>[day,select(day,candidates)]));
 const visibleStart=period==='all'?FIRST_DAY:new Date(Date.parse(end+'T00:00:00Z')-(Number(period)-1)*DAY_MS).toISOString().slice(0,10);
 const start=visibleStart<FIRST_DAY?FIRST_DAY:visibleStart;
 const rows=[];
 for(let at=Date.parse(start+'T00:00:00Z');at<=Date.parse(end+'T00:00:00Z');at+=DAY_MS){
  const day=new Date(at).toISOString().slice(0,10);
  const row=points.get(day)??select(day,[]);
  const prev=points.get(previousDay(day));
  if(compatible(prev,row)){
   if(prev.cybercab!==null&&row.cybercab!==null)row.dailyDeltaCybercab=row.cybercab-prev.cybercab;
   if(prev.model_y!==null&&row.model_y!==null)row.dailyDeltaModelY=row.model_y-prev.model_y;
  }
  rows.push(row);
 }
 return rows;
}
