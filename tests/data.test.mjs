import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregate,latest,history,comparableDelta,ingest,validateObservation,citiesFor,nextUpdate,findConflicts } from '../src/domain.mjs';
import { collectDataset,extractServices } from '../scripts/collector-lib.mjs';
import {parseCSV} from '../scripts/import-csv.mjs';
// Unit tests must not depend on the dates/statuses added by daily production runs.
const base={cities:['austin','dallas','houston','miami','orlando','tampa','seoul'].map(id=>({id,english:({austin:'Austin',dallas:'Dallas',houston:'Houston',miami:'Miami',orlando:'Orlando',tampa:'Tampa',seoul:'Seoul'})[id],country:id==='seoul'?'KR':'US',region:id==='seoul'?'SEOUL':['miami','orlando','tampa'].includes(id)?'FL':'TX'})),sources:['tesla-support','tesla-cybercab','tesla-ir-q3','ca-dmv','manual'].map(id=>({id,url:'https://example.test/'+id+(id==='tesla-ir-q3'?'.pdf':'')})),observations:[],services:[{id:'tesla-cybercab-austin',city:'austin',model:'cybercab',status:'limited',sourceId:'tesla-cybercab',observedAt:'2026-10-22T00:00:00Z',asOf:null}],news:[],sourceRuns:[],runs:[],revisions:[],lastSuccessAt:'2026-10-22T00:00:00Z'};
const f={country:'',region:'',city:'',model:'',basis:'deployed',status:'',verification:'verified'};
const make=(extra={})=>({id:'test',city:'austin',model:'model_y',basis:'deployed',count:10,asOf:'2026-10-22T00:00:00Z',collectedAt:'2026-10-23T00:00:00Z',sourceId:'manual',sourceUrl:'https://example.org/source',scope:'city fleet',verification:'official_single',note:'test fixture',...extra});
const withRows=observations=>({...structuredClone(base),observations});
test('unknown is null; explicit zero is zero; unverified examples excluded',()=>{
 assert.equal(aggregate(latest(base,f)).total,null);
 assert.equal(aggregate(latest(withRows([make({count:0})]),f)).total,0);
 assert.equal(aggregate(latest(withRows([make({verification:'unverified'})]),f)).total,null);
 assert.equal(latest(base,{...f,verification:'all',basis:'allocated'}).length,0);
});
test('basis, model, region and service filters share the same rows',()=>{
 const data=withRows([make(),make({id:'cc',model:'cybercab',count:4}),make({id:'assigned',basis:'allocated',count:999}),make({id:'dallas',city:'dallas',count:3})]);
 assert.equal(aggregate(latest(data,f)).total,17);
 assert.equal(aggregate(latest(data,{...f,region:'TX',model:'model_y'})).total,13);
 assert.equal(aggregate(latest(data,{...f,city:'austin'})).total,14);
 assert.equal(aggregate(latest(data,{...f,basis:'allocated'})).total,999);
 assert.ok(citiesFor(base,{...f,status:'unknown'}).some(c=>c.id==='seoul'));
 assert.equal(citiesFor(base,{...f,status:'testing',model:'cybercab'}).length,0);
});
test('conflicting same-time counts/definitions excluded; locked override survives',()=>{
 const a=make(),b=make({id:'second',count:12,sourceId:'tesla-support'});
 assert.equal(latest(withRows([a,b]),f).length,0);
 assert.equal(latest(withRows([a,{...b,verification:'unofficial'}]),f).length,0);
 assert.deepEqual(findConflicts([a,b])[0].ids,['test','second']);
 assert.equal(findConflicts([{...a,locked:true},b])[0].resolvedBy,'test');
 assert.equal(latest(withRows([a,{...b,count:10,scope:'seen last week'}]),f).length,0);
 assert.equal(latest(withRows([{...a,locked:true},b]),f)[0].count,10);
});
test('missing history stays missing; carry-forward is separate; changes need matching coverage',()=>{
 const rows=[make({asOf:'2026-10-21T00:00:00Z'})];
 const h=history(withRows(rows),f,'7',new Date('2026-10-23T01:00:00Z'));
 assert.equal(h.filter(x=>x.total!==null).length,1);
 assert.equal(h.at(-1).total,null);assert.equal(h.at(-1).carried.total,10);
 assert.equal(comparableDelta(rows,rows),null);
 assert.equal(comparableDelta([make({asOf:'2026-10-23T00:00:00Z',count:12})],[make()]),2);
 assert.equal(comparableDelta([make({scope:'different'})],[make()]),null);
 assert.equal(comparableDelta([make(),make({city:'dallas'})],[make()]),null);
 const moveA=[make({asOf:'2026-10-23T00:00:00Z',count:7}),make({id:'d',city:'dallas',asOf:'2026-10-23T00:00:00Z',count:3})];
 const moveB=[make({count:10}),make({id:'d',city:'dallas',count:0})];
 assert.equal(comparableDelta(moveA,moveB),0);
});
test('independent verification requires two distinct original source groups',()=>{
 assert.ok(validateObservation(make({verification:'independent',independentGroups:['tesla','tesla']}),base.cities,base.sources).length);
 assert.equal(validateObservation(make({verification:'independent',independentGroups:['tesla','regulator']}),base.cities,base.sources).length,0);
});
test('repeated ingestion idempotent, revisions recorded, manual lock protected',()=>{
 const d=withRows([make({locked:true})]);
 assert.deepEqual(ingest(d,[make({locked:false,count:20})],'2026-10-23'),d);
 const revised=ingest(d,[make({locked:true,count:20})],'2026-10-23');
 assert.equal(revised.observations[0].count,20);assert.equal(revised.revisions.length,d.revisions.length+1);
 assert.deepEqual(ingest(revised,[make({locked:true,count:20})],'2026-10-23'),revised);
});
test('collector failure preserves last-good observations, services and dates',async()=>{
 const d=withRows([make()]);
 const result=await collectDataset(d,{now:'2026-10-24T00:00:00Z',forceFailure:true,retries:1});
 assert.deepEqual(result.observations,d.observations);assert.deepEqual(result.services,d.services);
 assert.equal(result.lastSuccessAt,d.lastSuccessAt);assert.equal(result.runs.find(r=>r.id==='daily-2026-10-24').state,'failed');
});
test('deterministic official extraction, per-model statuses, no counts inferred',()=>{
 const facts=extractServices('tesla-cybercab','Robotaxi is currently operating in Tampa and Miami, Florida and Austin, Dallas, and Houston, Texas with Model Y vehicles. Cybercab rides are currently available in limited areas of Austin, Texas.',base.cities,'2026-10-23T00:00:00Z');
 assert.equal(facts.length,6);assert.equal(facts.filter(f=>f.model==='cybercab').length,1);
 assert.ok(facts.every(f=>f.safety==='unknown'&&!('count' in f)));
 assert.throws(()=>extractServices('tesla-cybercab','Cybercab has 9000 cars',base.cities,'now'));
});
test('collector same-day rerun does not duplicate news, daily runs or numeric records',async()=>{
 const fetcher=async url=>url.endsWith('.pdf')?new Response('%PDF'+'.'.repeat(400)):new Response('<html>'+(' '.repeat(350))+(url.includes('cybercab')?'Robotaxi is currently operating in Tampa and Miami, Florida and Austin, Dallas, and Houston, Texas with Model Y vehicles. Cybercab rides are currently available in limited areas of Austin, Texas.':url.includes('dmv')?'TESLA ROBOTAXI LLC':'Currently, we provide service in limited areas of Miami, Orlando and Tampa, Florida and Austin, Dallas, and Houston, Texas.')+'</html>');
 const a=await collectDataset(base,{fetcher,now:'2026-10-24T00:00:00Z',retries:1});
 const b=await collectDataset(a,{fetcher,now:'2026-10-24T02:00:00Z',retries:1});
 assert.equal(b.news.length,a.news.length);assert.equal(b.runs.length,a.runs.length);assert.deepEqual(b.observations,base.observations);
 assert.equal(b.runs.find(r=>r.id==='daily-2026-10-24').state,'success');
 assert.equal(b.services.find(s=>s.id==='tesla-cybercab-austin').observedAt,base.services.find(s=>s.id==='tesla-cybercab-austin').observedAt);
});
test('collector targets the requested day even with newer historical runs and remains idempotent',async()=>{
 const d={...withRows([make()]),runs:[{id:'daily-2026-10-24',state:'success'},{id:'daily-2026-10-25',state:'partial'}]};
 const a=await collectDataset(d,{now:'2026-10-24T00:00:00Z',forceFailure:true,retries:1});
 const b=await collectDataset(a,{now:'2026-10-24T02:00:00Z',forceFailure:true,retries:1});
 assert.equal(b.runs.find(r=>r.id==='daily-2026-10-24').state,'failed');
 assert.deepEqual(b.runs.find(r=>r.id==='daily-2026-10-25'),d.runs[1]);
 assert.equal(b.runs.length,d.runs.length);assert.deepEqual(b.observations,d.observations);
});
test('CSV quoted fields and missing count; KST next update',()=>{
 const records=parseCSV('id,count,note\n1,0,"zero, verified"\n2,,unknown');
 assert.equal(records[0].count,0);assert.equal(records[0].note,'zero, verified');assert.ok(Number.isNaN(records[1].count));
 assert.equal(nextUpdate('2026-10-23T00:00:00Z'),'2026-10-23T23:00:00.000Z');
});
test('ISO timestamps with different offsets compare by actual time',()=>{
 const data=withRows([make({asOf:'2026-10-23T08:00:00+09:00',count:8}),make({id:'newer',asOf:'2026-10-23T01:00:00Z',count:9})]);
 assert.equal(latest(data,f)[0].count,9);
 assert.equal(latest(data,f,'2026-10-23T00:00:00Z')[0].count,8);
 assert.equal(aggregate(data.observations).asOf,'2026-10-23T01:00:00Z');
 assert.ok(validateObservation(make({asOf:'2026-10-23'}),base.cities,base.sources).length);
});
