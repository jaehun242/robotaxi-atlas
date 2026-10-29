import {collectCityClaims} from './city-claims-lib.mjs';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {collectTexasRegistrations,applyRegistrationStatus,collectHistoricalModels} from './registration-lib.mjs';
const now=new Date().toISOString(),dry=process.argv.includes('--dry-run');
let atlas=JSON.parse(await readFile('public/data/atlas.json','utf8')),monitoring=JSON.parse(await readFile('public/data/monitoring.json','utf8'));
const registries=await collectTexasRegistrations(monitoring.registries,{now,forceFailure:process.argv.includes('--simulate-failure')});
applyRegistrationStatus(atlas,monitoring,registries,now);
monitoring.modelHistory=await collectHistoricalModels(monitoring.modelHistory,{now,forceFailure:process.argv.includes('--simulate-failure')});
for(const s of monitoring.modelHistory)console.log(JSON.stringify({source:s.sourceId,state:s.checkState,observations:s.observations.length,error:s.error,dry}));
atlas=await collectCityClaims(atlas,{now,forceFailure:process.argv.includes('--simulate-failure')});
if(!dry)for(const [name,value] of [['monitoring',monitoring],['atlas',atlas]]){const path=`public/data/${name}.json`;await writeFile(path+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(path+'.tmp',path);}
for(const r of registries)console.log(JSON.stringify({id:r.id,state:r.checkState,total:r.total,cybercab:r.cybercab,model_y:r.model_y,asOf:r.asOf,lastCheckedAt:r.lastCheckedAt,error:r.error,dry}));
