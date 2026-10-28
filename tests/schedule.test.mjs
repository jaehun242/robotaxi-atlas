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
