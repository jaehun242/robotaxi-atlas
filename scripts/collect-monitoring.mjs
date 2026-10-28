import {readFile,writeFile,rename} from 'node:fs/promises';
import {monitorDocument,coverageSummary} from './monitoring-lib.mjs';
import {collectTexasRegistrations,applyRegistrationStatus} from './registration-lib.mjs';
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
const [registry,privateRegistry]=await collectTexasRegistrations(prior.registries,{now,forceFailure});
const discovery=await collectDiscovery(prior.discovery,{now,forceFailure});
const atlasContext=await read('public/data/atlas.json');
discovery.officialPlans=atlasContext.services.filter(s=>s.id.startsWith('tesla-safety-plan-')).map(s=>({city:atlasContext.cities.find(c=>c.id===s.city)?.name??s.city,status:s.status,observedAt:s.observedAt,sourceUrl:s.sourceUrl}));
discovery.regionCandidates=atlasContext.regionCandidates??[];
const result={version:1,lastAttemptAt:now,jurisdictions:records,international,registries:[registry,privateRegistry],registrationHistory:prior.registrationHistory??[],discovery,summary:coverageSummary(records,now),runs:prior.runs??[]};
applyRegistrationStatus(atlasContext,result,[registry,privateRegistry],now);
result.summary=coverageSummary(records,now);
const run={id:'monitor-'+kstDay(now),startedAt:now,completedAt:new Date().toISOString(),summary:result.summary,discovery:discovery.lastRun};const index=result.runs.findIndex(r=>r.id===run.id);if(index<0)result.runs.push(run);else result.runs[index]=run;result.runs=result.runs.slice(-90);
if(!dry){await writeFile('public/data/monitoring.json.tmp',JSON.stringify(result,null,2)+'\n');await rename('public/data/monitoring.json.tmp','public/data/monitoring.json');}
if(!dry){
 const atlas=atlasContext;
 const daily=atlas.runs.find(r=>r.id==='daily-'+kstDay(now));if(daily){daily.completedAt=run.completedAt;if(result.summary.accessFailed||result.summary.extractionFailed)daily.state='partial';}
 await writeFile('public/data/atlas.json.tmp',JSON.stringify(atlas,null,2)+'\n');await rename('public/data/atlas.json.tmp','public/data/atlas.json');
}
console.log(JSON.stringify({summary:result.summary,discovery:discovery.lastRun,dry}));
