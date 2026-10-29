import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalModelTimeline} from '../src/canonical-model-history.mjs';
const observation=(date,cybercab,model_y,total,extra={})=>({id:date,date,cybercab,model_y,total,firstCollectedAt:'2026-10-29T00:00:00Z',...extra});
const source=(sourceId,observations,extra={})=>({sourceId,name:sourceId,url:'https://example.com/'+sourceId,verification:'unofficial',scope:'US-TX',basis:'registered',dateBasis:'publisher_calendar_timezone_unknown',observations,...extra});
const row=(rows,date)=>rows.find(r=>r.day===date);

test('known timestamps become KST days while source dates and missing days remain intact',()=>{
 const sources=[source('snapshots',[observation('2026-06-09',0,59,59,{observedAt:'2026-06-09T16:01:27.815Z'}),observation('2026-06-11',0,69,69,{observedAt:'2026-06-11T00:54:00Z'})],{dateBasis:'UTC_snapshot_day'})];
 const rows=canonicalModelTimeline(sources,{end:'2026-06-12'});
 assert.equal(rows[0].day,'2026-06-09');assert.equal(rows[0].model_y,null);
 assert.equal(row(rows,'2026-06-10').model_y,59);assert.equal(row(rows,'2026-06-10').cybercab,0);
 assert.equal(row(rows,'2026-06-10').selected.sourceDate,'2026-06-09');
 assert.equal(row(rows,'2026-06-10').selected.sourceDateBasis,'UTC_snapshot_day');
 assert.equal(row(rows,'2026-06-10').selected.dateBasis,'KST_confirmation_day');
 assert.equal(row(rows,'2026-06-10').selected.verification,'unofficial');
 assert.equal(row(rows,'2026-06-12').model_y,null);
});
test('official observations win even when later unofficial values are larger, without losing alternatives',()=>{
 const sources=[source('tracker',[observation('2026-10-25',463,507,970,{observedAt:'2026-10-25T10:18:20Z'})]),source('direct',[observation('2026-10-25',431,507,938,{observedAt:'2026-10-25T00:41:17Z'})],{verification:'official_single'})];
 const rows=canonicalModelTimeline(sources,{end:'2026-10-25',period:'1'}),r=rows[0];
 assert.equal(r.cybercab,431);assert.equal(r.total,938);assert.equal(r.selected.sourceId,'direct');assert.equal(r.candidates.length,2);assert.equal(r.conflict,false);
 assert.deepEqual(canonicalModelTimeline([...sources].reverse(),{end:'2026-10-25',period:'1'}),rows);
 assert.equal(canonicalModelTimeline(sources,{end:'2026-10-25',period:'1',verifiedOnly:true})[0].candidates.length,1);
});
test('latest actual observation wins before date-only publications; no maximum or average rule',()=>{
 const sources=[source('earlier',[observation('2026-09-25',126,420,546,{observedAt:'2026-09-25T01:00:00Z'})]),source('later',[observation('2026-09-25',69,420,489,{observedAt:'2026-09-25T10:00:00Z'})]),source('article',[observation('2026-09-25',150,420,570,{publishedAt:'2026-09-26T12:00:00Z'})])];
 const r=canonicalModelTimeline(sources,{end:'2026-09-25',period:'1'})[0];
 assert.equal(r.cybercab,69);assert.equal(r.selected.sourceId,'later');assert.equal(r.candidates.length,3);
});
test('date-only source preference and publication ties are deterministic; complete observations win equal ranks',()=>{
 const sources=[source('article-old',[observation('2026-10-05',169,420,589,{publishedAt:'2026-10-06T00:00:00Z'})]),source('article-new',[observation('2026-10-05',170,420,590,{publishedAt:'2026-10-07T00:00:00Z'})]),source('tslafg',[observation('2026-10-05',168,420,588)])];
 assert.equal(canonicalModelTimeline(sources,{end:'2026-10-05',period:'1'})[0].selected.sourceId,'tslafg');
 assert.equal(canonicalModelTimeline(sources.slice(0,2),{end:'2026-10-05',period:'1'})[0].selected.sourceId,'article-new');
 const partial=source('partial',[observation('2026-10-05',null,420,589)]),complete=source('complete',[observation('2026-10-05',169,420,589)]);
 assert.equal(canonicalModelTimeline([partial,complete],{end:'2026-10-05',period:'1'})[0].selected.sourceId,'complete');
});
test('partial observations never borrow another source model or retain a misleading total',()=>{
 const sources=[source('only-y',[observation('2026-08-27',null,270,270,{observedAt:'2026-08-27T12:00:00Z'})]),source('only-cc',[observation('2026-08-27',7,null,277,{observedAt:'2026-08-27T10:00:00Z'})])];
 const r=canonicalModelTimeline(sources,{end:'2026-08-27',period:'1'})[0];
 assert.equal(r.cybercab,null);assert.equal(r.model_y,270);assert.equal(r.total,null);assert.equal(r.candidates[0].total,270);
});
test('same-instant equally ranked conflicts are blank rather than arbitrarily resolved',()=>{
 const instant='2026-09-25T10:00:00Z';
 const a=source('a',[observation('2026-09-25',69,420,489,{observedAt:instant})]),b=source('b',[observation('2026-09-25',126,420,546,{observedAt:instant})]);
 const r=canonicalModelTimeline([a,b],{end:'2026-09-25',period:'1'})[0];
 assert.equal(r.conflict,true);assert.equal(r.selected,null);assert.equal(r.cybercab,null);assert.equal(r.model_y,null);assert.equal(r.candidates.length,2);
 assert.deepEqual(canonicalModelTimeline([b,a],{end:'2026-09-25',period:'1'})[0],r);
});
test('daily change requires adjacent compatible observations and keeps zero, negative, and period boundary comparisons',()=>{
 const s=source('direct',[
 observation('2026-10-21',349,454,803,{observedAt:'2026-10-21T01:00:00Z'}),
 observation('2026-10-22',349,454,803,{observedAt:'2026-10-22T01:00:00Z'}),
 observation('2026-10-23',348,454,802,{observedAt:'2026-10-23T01:00:00Z'}),
 observation('2026-10-25',431,507,938,{observedAt:'2026-10-25T01:00:00Z'})
 ],{verification:'official_single',dateBasis:'KST_confirmation_day'});
 const rows=canonicalModelTimeline([s],{end:'2026-10-25',period:'4'});
 assert.equal(rows[0].day,'2026-10-22');assert.equal(rows[0].dailyDeltaCybercab,0);
 assert.equal(rows[1].dailyDeltaCybercab,-1);assert.equal(rows[2].dailyDeltaCybercab,null);assert.equal(rows[3].dailyDeltaCybercab,null);
});
test('source, date-basis, and verification transitions cannot create spurious daily growth',()=>{
 const a=source('a',[observation('2026-10-21',349,454,803),observation('2026-10-22',351,507,858,{observedAt:'2026-10-22T01:00:00Z'})]),b=source('b',[observation('2026-10-23',420,507,927,{observedAt:'2026-10-23T01:00:00Z'})]);
 const rows=canonicalModelTimeline([a,b],{end:'2026-10-23',period:'3'});
 assert.equal(rows[1].dailyDeltaCybercab,null);assert.equal(rows[2].dailyDeltaCybercab,null);
});
test('failed source checks do not move retained historical observations to the attempt day',()=>{
 const s=source('last-good',[observation('2026-10-23',351,507,858,{observedAt:'2026-10-23T01:00:00Z'})],{checkState:'failed',lastAttemptAt:'2026-10-29T10:00:00Z',lastSuccessAt:'2026-10-23T01:00:00Z'});
 const before=structuredClone(s),rows=canonicalModelTimeline([s],{end:'2026-10-29',period:'7'});
 assert.equal(rows[0].cybercab,351);assert.ok(rows.slice(1).every(r=>r.cybercab===null&&r.model_y===null));assert.deepEqual(s,before);
});
test('unsupported definitions, invalid partitions, and unverified values cannot enter representative counts',()=>{
 const sources=[
 source('city',[observation('2026-10-25',5,6,11)],{scope:'austin'}),
 source('service',[observation('2026-10-25',5,6,11)],{basis:'commercial'}),
 source('bad-sum',[observation('2026-10-25',5,6,12)]),
 source('unverified',[observation('2026-10-25',500,600,1100)],{verification:'unverified'}),
 source('total-only',[observation('2026-10-25',null,null,1000)]),
 source('bad-time',[observation('2026-10-25',5,6,11,{observedAt:'not-a-time'})])
 ];
 const r=canonicalModelTimeline(sources,{end:'2026-10-25',period:'1'})[0];
 assert.equal(r.selected,null);assert.equal(r.cybercab,null);assert.equal(r.total,null);
 assert.deepEqual(new Set(r.candidates.map(c=>c.sourceId)),new Set(['bad-sum','unverified','total-only']));
});

test('a date-only or timezone-free claimed observation time is not promoted to an actual KST timestamp',()=>{
 const data=source('bad-time',[observation('2026-06-09',0,69,69,{observedAt:'2026-06-09'}),observation('2026-06-10',0,69,69,{observedAt:'2026-06-10T16:00:00'})]);
 const rows=canonicalModelTimeline([data],{end:'2026-06-11'});
 assert.ok(rows.every(r=>r.selected===null));
});
test('indistinguishable same-source date-only corrections cannot depend on input order',()=>{
 const observations=[observation('2026-06-09',0,59,59),observation('2026-06-09',0,69,69)];
 const before=canonicalModelTimeline([source('archive',observations)],{end:'2026-06-09'});
 assert.equal(before[0].conflict,true);assert.equal(before[0].model_y,null);
 const after=canonicalModelTimeline([source('archive',[...observations].reverse())],{end:'2026-06-09'});
 assert.equal(after[0].conflict,true);assert.equal(after[0].model_y,null);assert.deepEqual(after,before);
});

test('a successful next KST day becomes a new official graph point; unchanged is zero delta and a failed day stays blank',async()=>{
 const {appendRegistrationHistory}=await import('../src/fleet-changes.mjs');
 const {historicalModelSources}=await import('../src/model-history-charts.mjs');
 const registry={id:'tx-tesla-official',checkState:'ok',total:69,cybercab:0,model_y:69,unknown:0,asOf:'2026-06-10T00:00:00Z',sourceUrl:'https://example.org/official'};
 let history=appendRegistrationHistory([],registry,'2026-06-10T23:00:00Z');
 history=appendRegistrationHistory(history,registry,'2026-06-11T23:00:00Z');
 history=appendRegistrationHistory(history,{...registry,checkState:'failed'},'2026-06-12T23:00:00Z');
 const rows=canonicalModelTimeline(historicalModelSources(null,[],history),{end:'2026-06-13'});
 assert.equal(rows.find(r=>r.day==='2026-06-11').model_y,69);
 assert.equal(rows.find(r=>r.day==='2026-06-12').model_y,69);
 assert.equal(rows.find(r=>r.day==='2026-06-12').dailyDeltaModelY,0);
 assert.equal(rows.find(r=>r.day==='2026-06-13').model_y,null);
 assert.equal(history.length,2);
});

