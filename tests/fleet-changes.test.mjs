import test from 'node:test';
import assert from 'node:assert/strict';
import {appendRegistrationHistory,registrationDailyChanges,registrationChangeEvents,cityChangeEvents} from '../src/fleet-changes.mjs';
const r=(cc,my=507)=>({id:'tx-tesla-official',checkState:'ok',sourceUrl:'https://example.org/official',cybercab:cc,model_y:my,total:cc+my,unknown:0,asOf:'2026-10-23T04:00:00Z'});
test('same-day retries compress unchanged values, preserve change times and never append failed checks',()=>{
 const a=appendRegistrationHistory([],r(351),'2026-10-23T04:00:00Z');
 const b=appendRegistrationHistory(a,r(351),'2026-10-23T05:00:00Z');assert.equal(b.length,1);assert.equal(b[0].checkedAt,a[0].checkedAt);assert.equal(b[0].valueAsOf,a[0].valueAsOf);
 assert.deepEqual(appendRegistrationHistory(b,{...r(0),checkState:'failed'},'2026-10-24T04:00:00Z'),b);
 const c=appendRegistrationHistory(b,r(420),'2026-10-24T01:00:00Z');assert.equal(registrationChangeEvents(c)[0].delta,69);assert.equal(registrationDailyChanges(c)[1].deltaModelY,0);
 assert.throws(()=>appendRegistrationHistory(c,{...r(420),total:999},'2026-10-24T02:00:00Z'));
});
test('daily KST changes retain gaps and intraday details without treating the first record as growth',()=>{
 let h=[];for(const [at,count] of [['2026-10-25T00:00:00Z',431],['2026-10-28T00:30:00Z',544],['2026-10-28T07:16:00Z',573]])h=appendRegistrationHistory(h,r(count),at);
 const d=registrationDailyChanges(h);assert.equal(d.length,2);assert.equal(d[0].deltaCybercab,null);assert.equal(d[1].deltaCybercab,142);assert.equal(d[1].gapDays,3);assert.equal(d[1].previousDay,'2026-10-25');
 const events=registrationChangeEvents(h);assert.equal(events.length,2);assert.equal(events.at(-1).delta,29);assert.equal(events.at(-1).gapDays,0);
 const midnight=appendRegistrationHistory(h,r(573),'2026-10-28T15:01:00Z');assert.equal(registrationDailyChanges(midnight).at(-1).day,'2026-10-29');assert.equal(registrationDailyChanges(midnight).at(-1).deltaTotal,0);
});
test('city changes include intraday revisions but exclude unverified counts and respect model/source filters',()=>{
 const row=(extra={})=>({id:'a',city:'austin',model:'model_y',basis:'observed',verification:'unofficial',sourceId:'tracker',sourceUrl:'https://example.org/tracker',scope:'Austin registry',count:226,asOf:'2026-10-23T04:00:00Z',...extra});
 const previous=row({id:'b',count:235,asOf:'2026-10-28T00:00:00Z'}),latest=row({id:'b',count:237,asOf:'2026-10-28T07:00:00Z'});
 const data={cities:[{id:'austin',country:'US',region:'TX'}],services:[],observations:[row(),latest,row({id:'user',count:999,verification:'unverified'})],revisions:[{previous,replacement:latest}]};
 const filters={country:'US',region:'TX',city:'',model:'',status:'',verification:'credible'};
 const e=cityChangeEvents(data,filters);assert.equal(e.length,2);assert.equal(e[0].delta,2);assert.equal(e[1].delta,9);assert.equal(e[1].gapDays,5);
 assert.equal(cityChangeEvents(data,{...filters,verification:'verified'}).length,0);assert.equal(cityChangeEvents(data,{...filters,model:'cybercab'}).length,0);
 data.observations.push(row({id:'other-source',sourceId:'other',count:777,asOf:'2026-10-28T08:00:00Z'}));assert.equal(cityChangeEvents(data,filters).length,2);
});
