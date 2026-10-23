import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import { collectDataset } from './collector-lib.mjs';
import { parseCSV } from './import-csv.mjs';
import { aggregate,latest,kstDay,nextUpdate } from '../src/domain.mjs';
const data=JSON.parse(await readFile('public/data/atlas.json','utf8'));
const json=JSON.parse((await readFile('data/manual.json','utf8')).replace(/^\ufeff/,''));
const csv=parseCSV(await readFile('data/manual.csv','utf8'));
const now=new Date().toISOString();
const manual=[...new Map([...json,...csv].map(o=>[o.id,{...o,locked:o.locked!==false,collectedAt:o.collectedAt??now}])).values()];
const result=await collectDataset(data,{manual,now,forceFailure:process.argv.includes('--simulate-failure')});
const completedAt=new Date().toISOString();result.updatedAt=completedAt;result.nextUpdateAt=nextUpdate(completedAt);result.runs.find(r=>r.startedAt===now).completedAt=completedAt;
const dry=process.argv.includes('--dry-run');
if(!dry){
  await writeFile('public/data/atlas.json.tmp',JSON.stringify(result,null,2)+'\n');
  await rename('public/data/atlas.json.tmp','public/data/atlas.json');
  await mkdir('data/snapshots',{recursive:true});
  const summaries=Object.fromEntries(['allocated','deployed','testing','commercial'].map(basis=>[basis,aggregate(latest(result,{country:'',region:'',city:'',model:'',status:'',verification:'verified',basis}))]));
  await writeFile(`data/snapshots/${kstDay(now)}.json`,JSON.stringify({date:kstDay(now),runAt:now,summaries,observations:result.observations,services:result.services,sourceRuns:result.sourceRuns},null,2)+'\n');
}
for(const r of result.sourceRuns)console.log(`${r.sourceId}: ${r.state} — ${r.message}`);
console.log(`Run: ${result.runs.at(-1).state}; observations: ${result.observations.length}; ${dry?'dry-run (no files written)':'saved'}`);
// Partial and total source failure still publish last-good data with a visible failure state.
// Validation errors throw before writing anything, and fail the workflow.
