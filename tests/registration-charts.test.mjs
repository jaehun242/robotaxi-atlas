import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRegistrationArchive,mergeRegistrationArchive} from '../scripts/registration-archive-lib.mjs';
import {archiveTimeline,officialTimeline} from '../src/registration-charts.mjs';
const data={generated_at:'2026-10-28T00:00:00-07:00',fleet_history:{dates:['2026-07-29','2026-07-30','2026-08-10','2026-08-11','2026-08-12'],series:[{operator_id:1,data:[175,181,186,185,185]},{operator_id:2,data:[999,999,999,999,999]}]}};
test('publisher archive selects Tesla only, keeps decreases and never derives historical model counts',()=>{
 const r=parseRegistrationArchive(data,{id:1});assert.equal(r.points[0].total,175);assert.ok(r.points.every(p=>p.cybercab===null&&p.model_y===null));assert.equal(r.timezone,null);
 const rows=archiveTimeline(r);assert.equal(rows.find(p=>p.day==='2026-07-31').total,null);assert.equal(rows.find(p=>p.day==='2026-08-10').deltaTotal,null);assert.equal(rows.find(p=>p.day==='2026-08-11').deltaTotal,-1);assert.equal(rows.at(-1).deltaTotal,0);
 assert.equal(archiveTimeline(r,'7').length,7);
 assert.throws(()=>parseRegistrationArchive({...data,fleet_history:{...data.fleet_history,dates:['2026-02-31',...data.fleet_history.dates.slice(1)]}},{id:1}));
 assert.throws(()=>parseRegistrationArchive(data,{id:99}));
});
test('failed archive import preserves dates and values; corrected history retains revision evidence',()=>{
 const input=parseRegistrationArchive(data,{id:1}),a=mergeRegistrationArchive(null,input,'2026-10-28T07:00:00Z');
 const b=mergeRegistrationArchive(a,null,'2026-10-29T07:00:00Z','HTTP 403');assert.deepEqual(b.points,a.points);assert.equal(b.sourceAsOf,a.sourceAsOf);assert.equal(b.checkState,'failed');
 const changed=structuredClone(input);changed.points[0].total=174;const c=mergeRegistrationArchive(a,changed,'2026-10-29T08:00:00Z');assert.equal(c.revisions[0].previous,175);assert.equal(c.revisions[0].replacement,174);assert.equal(c.points[0].firstCollectedAt,a.points[0].firstCollectedAt);
});
test('official chart leaves missing days blank instead of filling model values or daily deltas',()=>{
 const row=(checkedAt,cc)=>({id:checkedAt,sourceId:'official',scopeId:'TX',basis:'registered',checkedAt,total:cc+507,cybercab:cc,model_y:507,unknown:0});
 const r=officialTimeline([row('2026-10-25T00:00:00Z',431),row('2026-10-28T00:00:00Z',544)],'all','2026-10-28T08:00:00Z');
 assert.equal(r.length,4);assert.equal(r[1].cybercab,null);assert.equal(r[2].total,null);assert.equal(r.at(-1).cybercab,544);assert.equal(r.at(-1).gapDays,3);
});
test('official daily model bars use day-end snapshots, preserve true zero and negative changes',()=>{
 const row=(checkedAt,cc,my)=>({id:checkedAt,sourceId:'official',scopeId:'TX',basis:'registered',checkedAt,total:cc+my,cybercab:cc,model_y:my,unknown:0});
 const r=officialTimeline([row('2026-10-23T00:00:00Z',100,50),row('2026-10-24T00:00:00Z',103,50),row('2026-10-24T12:00:00Z',105,50),row('2026-10-25T00:00:00Z',104,52),row('2026-10-28T00:00:00Z',120,55),row('2026-10-29T00:00:00Z',120,55)],'all','2026-10-29T08:00:00Z');
 assert.equal(r[0].dailyDeltaCybercab,null);
 assert.equal(r[1].cybercab,105);assert.equal(r[1].dailyDeltaCybercab,5);assert.equal(r[1].dailyDeltaModelY,0);assert.equal(r[1].dailyDeltaTotal,5);
 assert.equal(r[2].dailyDeltaCybercab,-1);assert.equal(r[2].dailyDeltaModelY,2);assert.equal(r[2].dailyDeltaTotal,1);
 assert.equal(r[3].dailyDeltaCybercab,null);assert.equal(r[4].dailyDeltaModelY,null);
 const afterGap=r.find(p=>p.day==='2026-10-28');assert.equal(afterGap.gapDays,3);assert.equal(afterGap.deltaCybercab,16);assert.equal(afterGap.dailyDeltaCybercab,null);assert.equal(afterGap.dailyDeltaTotal,null);
 assert.equal(r.at(-1).dailyDeltaCybercab,0);assert.equal(r.at(-1).dailyDeltaModelY,0);
});
test('daily model changes respect KST midnight and compare to a day outside selected period',()=>{
 const row=(checkedAt,cc)=>({id:checkedAt,sourceId:'official',scopeId:'TX',basis:'registered',checkedAt,total:cc+5,cybercab:cc,model_y:5,unknown:0});
 const r=officialTimeline([row('2026-10-22T14:59:59Z',10),row('2026-10-22T15:00:00Z',14)],'7','2026-10-29T00:00:00Z');
 assert.equal(r.length,7);assert.equal(r[0].day,'2026-10-23');assert.equal(r[0].dailyDeltaCybercab,4);assert.equal(r[0].dailyDeltaModelY,0);
});

