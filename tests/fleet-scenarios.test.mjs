import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {collectFleet,parseFleetSnapshot} from '../scripts/fleet-lib.mjs';
import {latest,aggregate,history} from '../src/domain.mjs';
import {calculateMarket,MODEL_VERSION} from '../src/market.mjs';
const base=JSON.parse(await readFile('public/data/atlas.json','utf8'));
const snapshot=JSON.parse(await readFile('data/fleet-fixture.json','utf8'));
const now='2026-10-23T05:00:00Z';
const fakeKey=Buffer.from('{}').toString('base64url')+'.'+Buffer.from('{"role":"anon"}').toString('base64url')+'.publictest';
// A syntactically valid public test token, never a real service credential.
const testKey='eyJ0eXAiOiJKV1QifQ.'+fakeKey.split('.')[1]+'.publictest';
const fetcher=(rows=snapshot.rows,runs=snapshot.runs)=>async url=>{
 if(url.endsWith('/cybercabtracker'))return new Response('<script type="module" src="/assets/index-test.js"></script>');
 if(url.endsWith('.js'))return new Response(`const endpoint="https://testproject.supabase.co";const publicAnon="${testKey}";`);
 return Response.json(url.includes('fleet_by_area')?rows:runs);
};
const empty=()=>({...structuredClone(base),observations:base.observations.filter(o=>o.sourceId!=='pioneer-tracker'),fleetReferences:[]});
const filter={country:'',region:'',city:'',model:'',status:'',basis:'observed',verification:'credible'};
test('real publisher snapshot validates partition and never assigns Bay Area to San Francisco',()=>{
 const data=parseFleetSnapshot(snapshot.rows,snapshot.runs,now);
 assert.equal(data.rows.find(r=>r.city==='Austin').model_y,226);
 assert.throws(()=>parseFleetSnapshot([{city:'Austin',total:1,cybercab:2}],snapshot.runs,now));
 assert.throws(()=>parseFleetSnapshot(snapshot.rows,[],now));
});
test('public aggregate ingestion fills six cities, excludes region and user examples from totals',async()=>{
 const data=await collectFleet(empty(),{fetcher:fetcher(),now});
 assert.equal(data.sourceRuns.find(s=>s.sourceId==='pioneer-tracker').state,'ok');
 assert.equal(data.observations.filter(o=>o.sourceId==='pioneer-tracker').length,12);
 assert.equal(aggregate(latest(data,filter)).total,565);
 assert.equal(aggregate(latest(data,{...filter,city:'austin'})).total,421);
 assert.equal(aggregate(latest(data,{...filter,city:'dallas',model:'model_y'})).total,72);
 assert.equal(aggregate(latest(data,{...filter,city:'houston',model:'cybercab'})).total,0);
 assert.equal(aggregate(latest(data,{...filter,city:'san-francisco'})).total,null);
 assert.equal(data.fleetReferences[0].model_y,747);
 assert.equal(latest(data,{...filter,verification:'verified'}).length,0);
 assert.equal(latest(data,{...filter,basis:'deployed'}).length,0);
 assert.deepEqual(data.observations.filter(o=>o.verification==='unverified'),base.observations.filter(o=>o.verification==='unverified'));
 assert.equal(history(data,filter,'7',new Date(now)).filter(d=>d.total!==null).length,1);
});
test('same count on a later mirror check keeps original observation dates; correction retains first collection',async()=>{
 const a=await collectFleet(empty(),{fetcher:fetcher(),now});
 const b=await collectFleet(a,{fetcher:fetcher(snapshot.rows,[{ok:true,ran_at:'2026-10-23T06:00:00Z'}]),now:'2026-10-23T06:30:00Z'});
 assert.deepEqual(b.observations,a.observations);
 const changed=snapshot.rows.map(r=>r.city==='Austin'?{...r,total:r.total+1,cybercab:r.cybercab+1}:r);
 const c=await collectFleet(b,{fetcher:fetcher(changed,[{ok:true,ran_at:'2026-10-23T07:00:00Z'}]),now:'2026-10-23T07:30:00Z'});
 assert.equal(c.observations.length,b.observations.length);
 const row=c.observations.find(r=>r.id.startsWith('pioneer-austin-cybercab'));
 assert.equal(row.count,196);assert.equal(row.collectedAt,now);assert.ok(c.revisions.length>b.revisions.length);
 assert.equal(c.observations.find(r=>r.id.startsWith('pioneer-austin-model_y')).asOf,a.observations.find(r=>r.id.startsWith('pioneer-austin-model_y')).asOf);
});
test('403 collection failure preserves last good counts, region references, and dates',async()=>{
 const a=await collectFleet(empty(),{fetcher:fetcher(),now});let requests=0;
 const b=await collectFleet(a,{fetcher:async()=>{requests++;return new Response('',{status:403});},now:'2026-10-24T05:00:00Z'});
 assert.equal(requests,1);assert.deepEqual(a.observations,b.observations);assert.deepEqual(a.fleetReferences,b.fleetReferences);
 assert.equal(b.sourceRuns.find(r=>r.sourceId==='pioneer-tracker').lastSuccessAt,now);
 assert.equal(b.sourceRuns.find(r=>r.sourceId==='pioneer-tracker').state,'failed');
});
test('all registered cities have sourced current and 2030 numeric defaults with coherent units',async()=>{
 const d=JSON.parse(await readFile('public/data/scenarios.json','utf8'));
 assert.equal(d.version,MODEL_VERSION);
 for(const city of base.cities){const p=d.defaults[city.id];assert.ok(p,city.id);assert.ok(p.evidence.some(e=>e.kind==='official'));
  for(const key of ['current','future']){const r=calculateMarket(p[key]);assert.ok(r.coherent,city.id+key);assert.ok(r.results.every(x=>Number.isSafeInteger(x.teslaFleet)&&x.teslaFleet>0&&x.marketFleet>=x.teslaFleet));}
  assert.equal(p.future.horizon,'2030');assert.equal(p.future.market,'expanded');assert.equal(p.future.additionalDistinct,true);
  assert.ok(p.future.additional>0);assert.equal(p.current.unit,'person_trips');assert.equal(p.current.occupancy,'1.3');
 }
 assert.notEqual(d.defaults.austin.current.scenarios[1].marketProductivity,d.defaults.dallas.current.scenarios[1].marketProductivity);
});
test('NHTS proxies reproduce weighted household/person units, exclude walking and retain source year',async()=>{
 const n=JSON.parse(await readFile('data/nhts-2022-proxy.json','utf8'));
 assert.equal(n.statisticalYear,2022);
 for(const b of n.bands.filter(b=>b.msaSizeCodes)){
  const t=b.taxiAndRidehail;assert.deepEqual(t.modeCodes,[15,16]);assert.deepEqual(b.privateCarVanSuvPickup.modeCodes,[1,2,3,4]);
  assert.ok(Math.abs(t.personTripsPerHouseholdPerDay-t.annualPersonTrips/b.weightedHouseholds/365)<1e-10);
 }
});

test('mirror attribution refreshes existing metadata without querying the protected original or persisting public keys',async()=>{
 const seed=empty();const source=seed.sources.find(s=>s.id==='pioneer-tracker');
 if(source)source.name='legacy mirror name';else seed.sources.push({id:'pioneer-tracker',name:'legacy mirror name'});
 const requested=[];const mock=fetcher();
 const data=await collectFleet(seed,{fetcher:async(url,options)=>{requested.push(String(url));return mock(url,options);},now});
 const metadata=data.sources.find(s=>s.id==='pioneer-tracker');
 assert.equal(metadata.name,'Robotaxi Tracker · Pioneerlands 공개 집계 미러');
 assert.equal(metadata.url,'https://pioneerlands.org/cybercabtracker');
 assert.equal(metadata.access,'public aggregate mirror');
 assert.match(metadata.definition,/Ethan McKanna/);assert.match(metadata.definition,/in service/);
 assert.ok(requested.every(url=>url.startsWith('https://pioneerlands.org/')||url.startsWith('https://testproject.supabase.co/')));
 assert.ok(requested.every(url=>!url.includes('robotaxitracker.com')));
 assert.ok(!JSON.stringify(data).includes(testKey));
 assert.equal(data.observations.filter(o=>o.sourceId==='pioneer-tracker').every(o=>o.basis==='observed'&&o.verification==='unofficial'&&o.coverageComplete===false),true);
});
