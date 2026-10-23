import {createHash} from 'node:crypto';
import {boundedFetch} from './statistics-lib.mjs';
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
 return {total:operator.fleet_size,...counts,sourceAsOf:operator.last_synced_at??data.generated_at,sourceUrl:'https://fsddb.com/robotaxi?operator=tesla-robotaxi-llc',contentHash:createHash('sha256').update(JSON.stringify([operator.fleet_size,counts])).digest('hex')};
}
