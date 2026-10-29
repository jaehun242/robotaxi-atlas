import {createHash} from 'node:crypto';
import {boundedFetch} from './statistics-lib.mjs';

export const MYCYBERCAB_URL='https://mycybercab.com/live';
const metadata={
 id:'mycybercab-austin-cybercab',
 sourceId:'mycybercab-austin',
 name:'MyCybercab · Austin fleet claim',
 sourceUrl:MYCYBERCAB_URL,
 country:'US',region:'TX',city:'austin',model:'cybercab',
 scopeId:'mycybercab:austin:reported-fleet',
 scope:'MyCybercab가 Austin 카드에 게시한 Cybercab fleet claim. 독립적인 도시 전체 조사나 당일 동시 영업 대수로 확인된 값이 아님.',
 basis:'reported_fleet',verification:'unofficial',
 vehicleDefinition:'Publisher-reported Austin Cybercab fleet claim; operational definition not independently verified.',
 datePrecision:'day',timezone:null,
 methodology:'Austin 카드의 Official fleet claim 항목만 읽음. Registered (TX)와 Unique seen은 이 값의 대체 자료로 사용하지 않음. 원문이 official이라고 부르더라도 당사 공식 확인으로 승격하지 않음.'
};
const monthNames={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const plain=value=>String(value).replace(/<[^>]*>/g,' ').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,hex,dec)=>{
 const n=Number.parseInt(hex??dec,hex?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';
}).replace(/&(?:nbsp|#160);/gi,' ').replace(/&middot;/gi,'·').replace(/&plus;/gi,'+').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const validDay=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
function closedDiv(html,index){
 const tokens=/<\/?div\b[^>]*>/gi;tokens.lastIndex=index;let depth=0,start=null,token;
 while((token=tokens.exec(html))){
  if(start===null)start=token.index;
  if(/^<\/div/i.test(token[0]))depth--;else depth++;
  if(depth===0)return html.slice(start,tokens.lastIndex);
 }
 throw Error('MyCybercab Austin 카드 HTML 닫힘 검증 실패');
}
function divsWithClass(html,klass){
 const matches=[],pattern=new RegExp('<div\\b[^>]*\\bclass\\s*=\\s*(["\\\'])[^"\\\']*\\b'+klass+'\\b[^"\\\']*\\1[^>]*>','gi');let match;
 while((match=pattern.exec(html)))matches.push(closedDiv(html,match.index));
 return matches;
}
function spanText(html,klass){
 const pattern=new RegExp('<span\\b[^>]*\\bclass\\s*=\\s*(["\\\'])[^"\\\']*\\b'+klass+'\\b[^"\\\']*\\1[^>]*>([\\s\\S]*?)<\\/span>','gi');
 return [...html.matchAll(pattern)].map(match=>plain(match[2]));
}
function sourceDate(sourceText,now){
 // The claim's short day is separate from the TxDMV registration date. A year
 // may come from the card's explicit date context, never the collection clock.
 const claim=sourceText.match(/@robotaxi\s*[·|:–-]\s*([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(20\d{2}))?\b/i);
 const raw=claim?claim[0].replace(/^@robotaxi\s*[·|:–-]\s*/i,''):null;
 const years=[...new Set([...sourceText.matchAll(/\b\d{1,2}\/\d{1,2}\/(20\d{2})\b/g)].map(m=>m[1]))];
 const year=claim?.[3]??(years.length===1?years[0]:null),month=claim?monthNames[claim[1].slice(0,3).toLowerCase()]:null;
 const asOf=claim&&year&&month?year+'-'+String(month).padStart(2,'0')+'-'+String(claim[2]).padStart(2,'0'):null;
 if(asOf&&!validDay(asOf))throw Error('MyCybercab 회사 발언 기준일 형식 변경');
 if(asOf&&asOf>now.slice(0,10))throw Error('MyCybercab 미래 기준일 거부');
 return {asOf,sourceAsOf:asOf,sourceDateText:raw,datePrecision:asOf?'day':'unknown',sourceDateYearContext:claim?.[3]?'claim_date':year?'explicit_card_date':'unavailable'};
}

export function parseMyCybercab(html,{now=new Date().toISOString()}={}){
 if(typeof html!=='string'||html.length>2_000_000)throw Error('MyCybercab HTML 크기·형식 변경');
 if(!Number.isFinite(Date.parse(now)))throw Error('MyCybercab 수집 시각 검증 실패');
 const clean=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
 const cards=divsWithClass(clean,'grid-city-card').filter(card=>divsWithClass(card,'gcc-name').some(name=>/^Austin\s*,\s*TX$/i.test(plain(name))));
 if(cards.length!==1)throw Error('MyCybercab Austin 카드 누락·중복');
 const card=cards[0],claims=[];
 for(const row of divsWithClass(card,'gcc-stat-row')){
  const labels=spanText(row,'gcc-stat-label'),values=spanText(row,'gcc-stat-val');
  if(labels.some(label=>/^Official fleet claim$/i.test(label))){
   if(labels.length!==1||values.length!==1)throw Error('MyCybercab fleet claim 구조 충돌');
   claims.push(values[0]);
  }
 }
 if(claims.length!==1)throw Error('MyCybercab Austin fleet claim 누락·중복');
 const text=claims[0];
 if(!/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)\s*\+?$/.test(text))throw Error('MyCybercab Austin fleet claim 대수·단위 변경');
 const count=Number(text.replace(/[,+\s]/g,''));
 if(!Number.isSafeInteger(count)||count<0)throw Error('MyCybercab Austin fleet claim 정수 검증 실패');
 const countQualifier=text.endsWith('+')?'at_least':'exact';
 const dateParts=divsWithClass(card,'gcc-source');
 if(dateParts.length!==1)throw Error('MyCybercab Austin 출처 문단 누락·중복');
 const citationText=plain(dateParts[0]);
 return {...metadata,...sourceDate(citationText,new Date(now).toISOString()),count,countQualifier,displayCount:count.toLocaleString('en-US')+(countQualifier==='at_least'?'+':''),
  sourceLabel:'Official fleet claim',publisherCitation:citationText,
  asOfMeaning:'MyCybercab가 해당 회사 발언의 기준일로 표기한 날짜. Tesla 원문을 직접 확인한 날짜나 실제 도시 배치일이 아님.',
  note:'사용자가 선택한 MyCybercab Austin 대표 자료. 573+ 같은 + 표기는 하한 수량으로 보존. 원문 회사 발표 링크와 전체 도시 명부 대조 방법은 확인되지 않았으며 비공식 게시 주장으로 취급.'};
}
const core=record=>JSON.stringify([record.count,record.countQualifier,record.asOf,record.sourceDateText]);
export async function collectMyCybercab(prior=null,{now=new Date().toISOString(),fetcher=fetch,forceFailure=false}={}){
 const backup={...metadata,count:null,countQualifier:null,asOf:null,sourceAsOf:null,lastSuccessAt:null,revisions:[],...structuredClone(prior??{})};
 try{
  if(forceFailure)throw Error('MyCybercab 수집 실패 모의');
  const response=await boundedFetch(MYCYBERCAB_URL,fetcher),html=await response.text();
  const incoming=parseMyCybercab(html,{now}),unchanged=prior&&core(prior)===core(incoming);
  const revisions=[...(prior?.revisions??[])];
  if(prior&&prior.count!==null&&!unchanged)revisions.push({changedAt:now,previous:{count:prior.count,countQualifier:prior.countQualifier,asOf:prior.asOf},replacement:{count:incoming.count,countQualifier:incoming.countQualifier,asOf:incoming.asOf}});
  const result={...incoming,firstCollectedAt:prior?.firstCollectedAt??now,observedAt:unchanged?prior.observedAt??now:now,
   fetchedAt:now,lastAttemptAt:now,lastCheckedAt:now,lastSuccessAt:now,checkState:'ok',error:null,revisions};
  result.contentHash=createHash('sha256').update(core(incoming)).digest('hex');
  return result;
 }catch(error){
  return {...backup,fetchedAt:backup.fetchedAt??null,lastAttemptAt:now,lastCheckedAt:now,checkState:'failed',error:String(error?.message??'수집 실패').slice(0,250)+' · 마지막 정상 주장 수치와 원래 기준일 유지'};
 }
}
