import {collectModelHistory} from './model-history-lib.mjs';
import {collectTexasHistory} from './texas-history-lib.mjs';
import {createHash} from 'node:crypto';
import {boundedFetch} from './statistics-lib.mjs';
import {appendRegistrationHistory} from '../src/fleet-changes.mjs';
import {parseRegistrationArchive,mergeRegistrationArchive} from './registration-archive-lib.mjs';
export const TX_API='https://txmccs.txdmv.gov/api/TruckStop/companies/81edcff1-8a6e-4ed0-be1f-60668515e223/automated-motor-vehicles';
export const TX_PAGE='https://txmccs.txdmv.gov/truckstop/companies/81edcff1-8a6e-4ed0-be1f-60668515e223/automated-motor-vehicles';
export function normalizeModel(value){const v=String(value).toLowerCase().replace(/[^a-z0-9]/g,'');return v==='cybercab'?'cybercab':['modely','teslamodely'].includes(v)?'model_y':'unknown';}
export function summarizeVehicles(vehicles,expected){
 const unique=new Map(),rawModels={};
 for(const v of vehicles){const vin=String(v.vin??'').trim().toUpperCase(),model=normalizeModel(v.model);
  if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw Error('VIN 형식 변경·누락');
  if(unique.has(vin)&&unique.get(vin)!==model)throw Error('동일 VIN 차종 충돌');
  if(!unique.has(vin)){unique.set(vin,model);rawModels[v.model]=(rawModels[v.model]??0)+1;}
 }
 if(unique.size!==expected)throw Error(`등록부 페이지 불일치: 고유 ${unique.size} / 원본 ${expected}. 마지막 정상값 유지`);
 const counts={cybercab:0,model_y:0,unknown:0};for(const model of unique.values())counts[model]++;
 return {total:unique.size,...counts,rawModels,duplicateRecords:vehicles.length-unique.size,contentHash:createHash('sha256').update([...unique].sort(([a],[b])=>a.localeCompare(b)).map(([vin,model])=>vin+'|'+model).join('\n')).digest('hex')};
}
export async function fetchTexasRegistry(fetcher=fetch){
 let total=null;const records=[];const limit=100,maxPages=30;
 for(let page=0;page<maxPages;page++){
  const r=await boundedFetch(`${TX_API}?limit=${limit}&offset=${page*limit}`,fetcher),data=await r.json();
  if(!Number.isSafeInteger(data.total)||data.total<0||data.total>limit*maxPages||!Array.isArray(data.vehicles))throw Error('공식 등록부 구조·규모 변경');
  if(total===null)total=data.total;if(total!==data.total)throw Error('수집 중 등록부 총계 변경. 다음 실행에서 재확인');
  records.push(...data.vehicles);if((page+1)*limit>=total)return {...summarizeVehicles(records,total),pages:page+1};
 }
 throw Error('등록부 페이지 제한 도달');
}
export function preserveRegistration(prior,incoming,now){
 if(prior?.contentHash===incoming.contentHash)return {...prior,lastCheckedAt:now,lastSuccessAt:now,checkState:'ok',error:null};
 return {...incoming,asOf:now,asOfMeaning:'공식 등록부 스냅샷을 확인한 시각. 모든 차량의 신규 등록일이 아님.',firstCollectedAt:prior?.firstCollectedAt??now,lastCheckedAt:now,lastSuccessAt:now,checkState:'ok',error:null};
}
export async function fetchPrivateTexasRegistry(fetcher=fetch){
 const url='https://fsddb.com/robotaxi.json?operator=tesla-robotaxi-llc&service=all';
 const data=await(await boundedFetch(url,fetcher)).json(),operator=data.operators?.find(o=>o.slug==='tesla-robotaxi-llc');
 if(!operator||!Number.isSafeInteger(operator.fleet_size)||!operator.models)throw Error('민간 재집계 구조 변경');
 const counts={cybercab:0,model_y:0,unknown:0};for(const [model,count] of Object.entries(operator.models)){if(!Number.isSafeInteger(count)||count<0)throw Error('민간 차종 집계 검증 실패');counts[normalizeModel(model)]+=count;}
 if(Object.values(counts).reduce((s,n)=>s+n,0)!==operator.fleet_size)throw Error('민간 총계·차종 합계 불일치');
 let historical=null,historyError=null;try{historical=parseRegistrationArchive(data,operator);}catch(e){historyError=e.message;}
 return {total:operator.fleet_size,...counts,sourceAsOf:operator.last_synced_at??data.generated_at,sourceUrl:'https://fsddb.com/robotaxi?operator=tesla-robotaxi-llc',contentHash:createHash('sha256').update(JSON.stringify([operator.fleet_size,counts])).digest('hex'),historical,historyError};
}
export async function collectTexasRegistrations(prior=[],{now=new Date().toISOString(),fetcher=fetch,forceFailure=false}={}){
 const old=prior.find(r=>r.id==='tx-tesla-official');let official;
 try{
  if(forceFailure)throw Error('수집 실패 모의');
  official=preserveRegistration(old,{id:'tx-tesla-official',country:'US',region:'TX',scope:'텍사스 전체 Tesla Robotaxi LLC 등록부',basis:'registered',verification:'official_single',sourceUrl:TX_PAGE,apiUrl:TX_API,note:'도시 배정 필드 없음. 사업자 주소로 도시 대수를 추정하지 않음. VIN 중복 제거·차종 대소문자 정규화. 배치·영업 대수와 별도.',...await fetchTexasRegistry(fetcher)},now);
 }catch(e){official={...(old??{id:'tx-tesla-official',region:'TX',sourceUrl:TX_PAGE,total:null,cybercab:null,model_y:null,asOf:null}),lastCheckedAt:now,checkState:'failed',error:e.message+' · 마지막 정상값 보존'};}
 const oldPrivate=prior.find(r=>r.id==='tx-tesla-fsddb');let privateRegistry;
 try{
  if(forceFailure)throw Error('수집 실패 모의');const {historical,historyError,...counts}=await fetchPrivateTexasRegistry(fetcher);
  privateRegistry=preserveRegistration(oldPrivate,{id:'tx-tesla-fsddb',region:'TX',scope:'Texas · FSD Database 민간 재집계',basis:'registered',verification:'unofficial',note:'동일 TxDMV 원자료의 재집계이며 독립 검증 출처가 아님. JSON은 집계만 제공.',...counts},now);
  privateRegistry.historical=mergeRegistrationArchive(oldPrivate?.historical,historical,now,historyError);
  if(!oldPrivate||oldPrivate.contentHash!==counts.contentHash){privateRegistry.asOf=Number.isFinite(Date.parse(counts.sourceAsOf))?new Date(counts.sourceAsOf).toISOString():now;privateRegistry.asOfMeaning='민간 재집계가 공개한 마지막 동기화 시각. 신규 등록일과 별도.';}
 }catch(e){privateRegistry={...(oldPrivate??{id:'tx-tesla-fsddb',region:'TX',verification:'unofficial',sourceUrl:'https://fsddb.com/robotaxi?operator=tesla-robotaxi-llc',total:null,cybercab:null,model_y:null,asOf:null}),lastCheckedAt:now,checkState:'failed',error:e.message,historical:mergeRegistrationArchive(oldPrivate?.historical,null,now,e.message)};}
 return [official,privateRegistry];
}
export function applyRegistrationStatus(atlas,monitoring,registries,now){
 monitoring.registries=registries;monitoring.registrationLastAttemptAt=now;
 const registry=registries.find(r=>r.id==='tx-tesla-official'),tx=monitoring.jurisdictions.find(r=>r.code==='TX');
 monitoring.registrationHistory=appendRegistrationHistory(monitoring.registrationHistory,registry,now,{evidenceUrl:process.env.GITHUB_RUN_ID?`https://github.com/jaehun242/robotaxi-atlas/actions/runs/${process.env.GITHUB_RUN_ID}`:undefined});
 if(tx)Object.assign(tx,{numericParserConnected:true,numericCheckState:registry.checkState,numericLastSuccessAt:registry.lastSuccessAt??null,numericReferenceDate:registry.asOf,quantityStatus:registry.checkState==='ok'?'available':'last_good_or_unknown'});
 const source=atlas.sources.find(s=>s.id==='tx-dmv');
 if(source)Object.assign(source,{url:TX_PAGE,automation:'텍사스 공식 주 전체 등록부 · 매시간 공개 JSON 수집·VIN 중복 제거',definition:'주 전체 등록 차량. 도시 배정·동시 운행 대수와 구분.'});
 atlas.sourceRuns=atlas.sourceRuns.filter(r=>r.sourceId!=='tx-dmv');atlas.sourceRuns.push({sourceId:'tx-dmv',state:registry.checkState==='ok'?'ok':'failed',checkedAt:now,lastSuccessAt:registry.lastSuccessAt??null,message:registry.checkState==='ok'?`공식 텍사스 등록부 ${registry.total}개 고유 VIN. Cybercab ${registry.cybercab} / Model Y ${registry.model_y}. 도시 합계와 별도.`:registry.error});
 // Do not relabel the daily city/news run or official-document check clocks.
}

export async function collectHistoricalModels(prior=[],options={}){
 return Promise.all([collectModelHistory(prior.find(s=>s.sourceId==='tslafg'),options),collectTexasHistory(prior.find(s=>s.sourceId==='texas-av-history'),options)]);
}
