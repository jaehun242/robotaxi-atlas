import test from 'node:test';import assert from 'node:assert/strict';
import{longTermTimeline,fleetLinePoints}from'../src/registration-charts.mjs';
import{appendRegistrationHistory}from'../src/fleet-changes.mjs';
import{mergeRegistrationArchive}from'../scripts/registration-archive-lib.mjs';
const official=(count=1080,state='ok')=>({id:'tx-tesla-official',checkState:state,sourceUrl:'https://official.test',asOf:'2026-10-28T07:16:00Z',total:count,cybercab:count-507,model_y:507});
const incoming=()=>({points:[{date:'2026-06-09',total:69},{date:'2026-10-25',total:970},{date:'2026-10-28',total:1080}],sourceAsOf:'2026-10-28T23:00:00Z'});
test('long-term default keeps first69 and conflicting source values separate with one common period',()=>{
 const archive=mergeRegistrationArchive(null,incoming(),'2026-10-29T00:00:00Z');
 const history=appendRegistrationHistory([],official(938),'2026-10-25T00:41:00Z');const next=appendRegistrationHistory(history,official(),'2026-10-29T00:10:00Z');
 const all=longTermTimeline(archive,next,'all','2026-10-29T01:00:00Z');assert.equal(all[0].day,'2026-06-09');assert.equal(all[0].total,69);assert.equal(all[0].official_total,null);
 const conflict=all.find(r=>r.day==='2026-10-25');assert.equal(conflict.total,970);assert.equal(conflict.official_total,938);assert.equal(all.at(-1).total,null);assert.equal(all.at(-1).official_total,1080);
 assert.equal(all.find(r=>r.day==='2026-07-31').total,null);assert.equal(longTermTimeline(archive,next,'7','2026-10-29T01:00:00Z').length,7);
 const geometry=fleetLinePoints(all,'official_total',{publisherDates:true});assert.equal(new Date(geometry.times.at(-1)).toISOString().slice(0,10),'2026-10-29');
});
test('each successful KST day adds a point even unchanged; same-day retries deduplicate and failed days stay blank',()=>{
 let history=appendRegistrationHistory([],official(),'2026-10-28T01:00:00Z');history=appendRegistrationHistory(history,official(),'2026-10-28T02:00:00Z');assert.equal(history.length,1);
 history=appendRegistrationHistory(history,official(),'2026-10-29T01:00:00Z');assert.equal(history.length,2);assert.equal(history[1].valueAsOf,'2026-10-28T07:16:00Z');
 history=appendRegistrationHistory(history,official(0,'failed'),'2026-10-30T01:00:00Z');assert.equal(history.length,2);
 const rows=longTermTimeline(mergeRegistrationArchive(null,incoming(),'2026-10-29T01:00:00Z'),history,'all','2026-10-30T02:00:00Z');assert.equal(rows.at(-2).official_total,1080);assert.equal(rows.at(-1).official_total,null);
});
test('publisher next-day history extends once, correction history and first collection survive failures',()=>{
 const a=mergeRegistrationArchive(null,incoming(),'2026-10-29T01:00:00Z');const fresh={...incoming(),points:[...incoming().points,{date:'2026-10-29',total:1080}]};const b=mergeRegistrationArchive(a,fresh,'2026-10-30T01:00:00Z'),c=mergeRegistrationArchive(b,fresh,'2026-10-30T02:00:00Z');assert.equal(b.points.length,a.points.length+1);assert.equal(c.points.length,b.points.length);assert.equal(c.points[0].firstCollectedAt,a.points[0].firstCollectedAt);
 const rolled=mergeRegistrationArchive(c,{...fresh,points:[{date:'2026-10-30',total:1080}]},'2026-10-31T00:00:00Z');assert.equal(rolled.points[0].date,'2026-06-09');assert.equal(rolled.points[0].total,69);
 const failed=mergeRegistrationArchive(c,null,'2026-10-31T01:00:00Z','403');assert.deepEqual(failed.points,c.points);assert.equal(failed.sourceAsOf,c.sourceAsOf);
});
