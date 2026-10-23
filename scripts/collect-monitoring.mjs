import {readFile,writeFile,rename} from 'node:fs/promises';
import {monitorDocument,coverageSummary} from './monitoring-lib.mjs';
import {fetchTexasRegistry,fetchPrivateTexasRegistry,preserveRegistration,TX_PAGE,TX_API} from './registration-lib.mjs';
import {collectDiscovery} from './discovery-lib.mjs';
import {kstDay} from '../src/domain.mjs';
const now=new Date().toISOString(),forceFailure=process.argv.includes('--simulate-failure'),dry=process.argv.includes('--dry-run');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const configs=[...await read('data/jurisdictions-a-m.json'),...await read('data/jurisdictions-mt-wy.json')];
if(configs.length!==51||new Set(configs.map(r=>r.code)).size!==51)throw Error('50개 주와 D.C. 목록 누락·중복');
let prior;try{prior=await read('public/data/monitoring.json');}catch{prior={jurisdictions:[],registries:[],runs:[],discovery:{items:[],runs:[]}};}
const records=new Array(configs.length);let cursor=0;
async function worker(){while(cursor<configs.length){const i=cursor++;records[i]=await monitorDocument(configs[i],prior.jurisdictions.find(r=>r.code===configs[i].code),{now,forceFailure});console.log(configs[i].code+': '+records[i].status);}}
await Promise.all([worker(),worker(),worker(),worker()]);
const internationalConfigs=await read('data/international-sources.json'),international=[];
for(const config of internationalConfigs)international.push(await monitorDocument(config,prior.international?.find(r=>r.code===config.code),{now,forceFailure}));
const old=prior.registries.find(r=>r.id==='tx-tesla-official');let registry;
try{if(forceFailure)throw Error('수집 실패 모의');const counts=await fetchTexasRegistry();registry=preserveRegistration(old,{id:'tx-tesla-official',country:'US',region:'TX',scope:'텍사스 전체 Tesla Robotaxi LLC 등록부',basis:'registered',verification:'official_single',sourceUrl:TX_PAGE,apiUrl:TX_API,note:'도시 배정 필드 없음. 사업자 주소로 도시 대수를 추정하지 않음. VIN 중복 제거·차종 대소문자 정규화. 배치·영업 대수와 별도.',...counts},now);console.log('TX official registry: '+registry.total+' unique VINs');}
catch(e){registry={...(old??{id:'tx-tesla-official',region:'TX',sourceUrl:TX_PAGE,total:null,cybercab:null,model_y:null,asOf:null}),lastCheckedAt:now,checkState:'failed',error:e.message+' · 마지막 정상값 보존'};console.log('TX official registry failed: '+e.message);}
const tx=records.find(r=>r.code==='TX');tx.numericParserConnected=true;tx.numericCheckState=registry.checkState;tx.numericLastSuccessAt=registry.lastSuccessAt??null;tx.numericReferenceDate=registry.asOf;tx.quantityStatus=registry.checkState==='ok'?'available':'last_good_or_unknown';
let privateRegistry;const oldPrivate=prior.registries.find(r=>r.id==='tx-tesla-fsddb');
try{if(forceFailure)throw Error('수집 실패 모의');const counts=await fetchPrivateTexasRegistry();privateRegistry=preserveRegistration(oldPrivate,{id:'tx-tesla-fsddb',region:'TX',scope:'Texas · FSD Database 민간 재집계',basis:'registered',verification:'unofficial',note:'동일 TxDMV 원자료의 재집계이며 독립 검증 출처가 아님. JSON은 집계만 제공.',...counts},now);if(!oldPrivate||oldPrivate.contentHash!==counts.contentHash){privateRegistry.asOf=Number.isFinite(Date.parse(counts.sourceAsOf))?new Date(counts.sourceAsOf).toISOString():now;privateRegistry.asOfMeaning='민간 재집계가 공개한 마지막 동기화 시각. 신규 등록일과 별도.';}}
catch(e){privateRegistry={...(oldPrivate??{id:'tx-tesla-fsddb',region:'TX',verification:'unofficial',sourceUrl:'https://fsddb.com/robotaxi?operator=tesla-robotaxi-llc',total:null,cybercab:null,model_y:null,asOf:null}),lastCheckedAt:now,checkState:'failed',error:e.message};}
const discovery=await collectDiscovery(prior.discovery,{now,forceFailure});
const atlasContext=await read('public/data/atlas.json');
discovery.officialPlans=atlasContext.services.filter(s=>s.id.startsWith('tesla-safety-plan-')).map(s=>({city:atlasContext.cities.find(c=>c.id===s.city)?.name??s.city,status:s.status,observedAt:s.observedAt,sourceUrl:s.sourceUrl}));
discovery.regionCandidates=atlasContext.regionCandidates??[];
const result={version:1,lastAttemptAt:now,jurisdictions:records,international,registries:[registry,privateRegistry],discovery,summary:coverageSummary(records,now),runs:prior.runs??[]};
const run={id:'monitor-'+kstDay(now),startedAt:now,completedAt:new Date().toISOString(),summary:result.summary,discovery:discovery.lastRun};const index=result.runs.findIndex(r=>r.id===run.id);if(index<0)result.runs.push(run);else result.runs[index]=run;result.runs=result.runs.slice(-90);
if(!dry){await writeFile('public/data/monitoring.json.tmp',JSON.stringify(result,null,2)+'\n');await rename('public/data/monitoring.json.tmp','public/data/monitoring.json');}
if(!dry){
 const atlas=await read('public/data/atlas.json'),source=atlas.sources.find(s=>s.id==='tx-dmv');
 if(source){source.url=TX_PAGE;source.automation='텍사스 공식 주 전체 등록부 · 공개 JSON 페이지 수집·VIN 중복 제거';source.definition='주 전체 등록 차량. 도시 배정·동시 운행 대수와 구분.';}
 atlas.sourceRuns=atlas.sourceRuns.filter(r=>r.sourceId!=='tx-dmv');atlas.sourceRuns.push({sourceId:'tx-dmv',state:registry.checkState==='ok'?'ok':'failed',checkedAt:now,lastSuccessAt:registry.lastSuccessAt??null,message:registry.checkState==='ok'?`공식 텍사스 등록부 ${registry.total}개 고유 VIN. Cybercab ${registry.cybercab} / Model Y ${registry.model_y}. 도시 합계와 별도.`:registry.error});
 const daily=atlas.runs.find(r=>r.id==='daily-'+kstDay(now));if(daily){daily.completedAt=run.completedAt;if(result.summary.accessFailed||result.summary.extractionFailed)daily.state='partial';}
 await writeFile('public/data/atlas.json.tmp',JSON.stringify(atlas,null,2)+'\n');await rename('public/data/atlas.json.tmp','public/data/atlas.json');
}
console.log(JSON.stringify({summary:result.summary,discovery:discovery.lastRun,dry}));
