import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshDecision,checkPublishedRefresh} from '../scripts/refresh-schedule.mjs';
const now='2026-10-28T00:17:00Z'; // 09:17 KST
const live={lastAttemptAt:'2026-10-27T23:02:00Z',runs:[{id:'daily-2026-10-28',state:'partial'}]};

test('daily backup skips only a same-day published collection after 08:00 KST',()=>{
 assert.equal(refreshDecision(live,{now}).refresh,false);
 for(const lastAttemptAt of ['2026-10-25T00:41:00Z','2026-10-27T22:59:00Z','2026-10-28T01:00:00Z',null])assert.equal(refreshDecision({...live,lastAttemptAt},{now}).refresh,true);
 assert.equal(refreshDecision({...live,runs:[]},{now}).refresh,true);
 assert.equal(refreshDecision({...live,runs:[{id:'daily-2026-10-28',state:'failed'}]},{now}).refresh,true);
 assert.equal(refreshDecision(live,{now,event:'workflow_dispatch'}).refresh,true);
});
test('published-site failure or malformed data allows recovery instead of blocking collection',async()=>{
 for(const fetcher of [async()=>{throw Error('timeout');},async()=>new Response('',{status:503}),async()=>new Response('bad json')])assert.equal((await checkPublishedRefresh({fetcher,now})).refresh,true);
 assert.equal((await checkPublishedRefresh({fetcher:async()=>Response.json(live),now})).refresh,false);
});

test('hourly watchdog does no HTTP work before 08:00 KST even on a manual dispatch',async()=>{
 for(const clock of ['2026-10-27T15:00:00Z','2026-10-27T22:59:59.999Z','2026-10-28T07:59:59+09:00']){
  let calls=0;
  for(const event of ['schedule','workflow_dispatch','push']){
   assert.equal(refreshDecision(null,{now:clock,event,mode:'watchdog'}).refresh,false);
   assert.equal((await checkPublishedRefresh({now:clock,event,mode:'watchdog',fetcher:async()=>{calls++;throw Error('must not fetch');}})).refresh,false);
  }
  assert.equal(calls,0);
 }
});
test('watchdog starts at the correct UTC boundary and resets at KST midnight',()=>{
 const options={mode:'watchdog',event:'workflow_dispatch'};
 assert.equal(refreshDecision(null,{...options,now:'2026-10-27T23:00:00Z'}).refresh,true);
 assert.equal(refreshDecision(null,{...options,now:'2026-10-28T08:00:00+09:00'}).refresh,true);
 assert.equal(refreshDecision(null,{...options,now:'2026-10-28T14:59:59Z'}).refresh,true);
 assert.equal(refreshDecision(null,{...options,now:'2026-10-28T15:00:00Z'}).refresh,false);
});
test('watchdog respects published success on dispatch and never substitutes a registry check',async()=>{
 const options={now,mode:'watchdog',event:'workflow_dispatch'};
 for(const state of ['success','partial']){
  const published={...live,runs:[{id:'daily-2026-10-28',state}]};
  assert.equal(refreshDecision(published,options).refresh,false);
  assert.equal((await checkPublishedRefresh({...options,fetcher:async()=>Response.json(published)})).refresh,false);
 }
 const registryOnly={lastAttemptAt:'2026-10-27T23:23:00Z',sourceRuns:[{sourceId:'tx-dmv',state:'ok',checkedAt:'2026-10-27T23:23:00Z'}],runs:[{id:'daily-2026-10-27',state:'partial'}]};
 assert.equal(refreshDecision(registryOnly,options).refresh,true);
 for(const published of [null,{}, {...live,runs:[]},{...live,runs:'malformed'}, {...live,runs:[{id:'daily-2026-10-28',state:'failed'}]}, {...live,lastAttemptAt:'2026-10-27T22:59:59Z'}, {...live,lastAttemptAt:'2026-10-28T01:00:00Z'}])assert.equal(refreshDecision(published,options).refresh,true);
});
const journal={version:1,attempts:[{id:'100:1',day:'2026-10-28',startedAt:'2026-10-27T23:23:00Z',kind:'hourly_daily_recovery'},{id:'101:1',day:'2026-10-28',startedAt:'2026-10-28T00:23:00Z',kind:'hourly_daily_recovery'}]};
test('watchdog counts distinct workflow attempts, resumes the same attempt and resets next day',()=>{
 const options={now,mode:'watchdog',journal};
 assert.equal(refreshDecision(null,options).refresh,false);
 assert.equal(refreshDecision(null,{...options,runId:'102:1'}).refresh,false);
 assert.equal(refreshDecision(null,{...options,runId:'101:1'}).refresh,true);
 assert.equal(refreshDecision(null,{...options,runId:'101:2'}).refresh,false);
 assert.equal(refreshDecision(null,{...options,journal:{version:1,attempts:[journal.attempts[0],journal.attempts[0]]}}).refresh,true);
 assert.equal(refreshDecision(null,{...options,now:'2026-10-28T23:23:00Z',runId:'102:1'}).refresh,true);
 assert.equal(refreshDecision(null,{...options,journal:undefined}).refresh,true);
 assert.equal(refreshDecision(null,{now,event:'workflow_dispatch',journal}).refresh,true);
});
test('published freshness wins over watchdog budget and source failures cannot bypass the limit',async()=>{
 const options={now,mode:'watchdog',journal,event:'workflow_dispatch'};
 assert.match(refreshDecision(live,options).reason,/이미 공개됨/);
 for(const fetcher of [async()=>{throw Error('timeout');},async()=>new Response('',{status:403}),async()=>new Response('bad json'),async()=>Response.json(null)]){
  assert.equal((await checkPublishedRefresh({...options,fetcher})).refresh,false);
  assert.equal((await checkPublishedRefresh({...options,journal:{version:1,attempts:journal.attempts.slice(0,1)},fetcher})).refresh,true);
 }
 for(const badJournal of [{invalid:true},{attempts:null},{attempts:[{day:'2026-10-28'}]}]){
  assert.equal(refreshDecision(null,{...options,journal:badJournal}).refresh,false);
  assert.equal(refreshDecision(live,{...options,journal:badJournal}).refresh,false);
 }
});
