import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {appendRegistrationHistory,registrationDailyChanges} from '../src/fleet-changes.mjs';
const path='public/data/monitoring.json',data=JSON.parse(await readFile(path,'utf8'));
const commits=execFileSync('git',['log','--reverse','--format=%H','--',path],{encoding:'utf8'}).trim().split(/\s+/).filter(Boolean);
let history=[];
for(const commit of commits){
 const old=JSON.parse(execFileSync('git',['show',commit+':'+path],{encoding:'utf8',maxBuffer:10*1024*1024}));
 const r=old.registries?.find(r=>r.id==='tx-tesla-official');
 if(r?.lastCheckedAt)history=appendRegistrationHistory(history,r,r.lastCheckedAt,{evidenceUrl:`https://github.com/jaehun242/robotaxi-atlas/blob/${commit}/${path}`});
}
// Preserve history collected after the last committed snapshot too.
for(const r of data.registrationHistory??[]){if(!history.some(h=>h.id===r.id))history.push(r);}
history.sort((a,b)=>Date.parse(a.checkedAt)-Date.parse(b.checkedAt));
if(process.argv.includes('--write')){data.registrationHistory=history;await writeFile(path,JSON.stringify(data,null,2)+'\n');}
console.log(JSON.stringify({write:process.argv.includes('--write'),days:registrationDailyChanges(history).map(r=>({day:r.day,total:r.total,cybercab:r.cybercab,model_y:r.model_y,deltaCybercab:r.deltaCybercab,deltaModelY:r.deltaModelY,previousDay:r.previousDay,gapDays:r.gapDays}))},null,2));
