import test from 'node:test';
import assert from 'node:assert/strict';
import {officialTimeline} from '../src/registration-charts.mjs';
test('attached confirmation table becomes model bars without assigning multi-day growth to one day',()=>{
 const row=(at,cc)=>({id:at,checkedAt:at,sourceId:'official',scopeId:'TX',basis:'registered',total:cc+507,cybercab:cc,model_y:507,unknown:0});
 const rows=officialTimeline([row('2026-10-23T05:00:00Z',351),row('2026-10-24T01:00:00Z',420),row('2026-10-25T00:00:00Z',431),row('2026-10-28T00:30:00Z',544),row('2026-10-28T07:16:00Z',573),row('2026-10-29T00:00:00Z',573)],'all','2026-10-29T08:00:00Z');
 assert.deepEqual(rows.map(r=>r.deltaCybercab),[null,69,11,null,null,142,0]);
 assert.deepEqual(rows.map(r=>r.deltaModelY),[null,0,0,null,null,0,0]);
 const gap=rows.find(r=>r.day==='2026-10-28');assert.equal(gap.previousDay,'2026-10-25');assert.equal(gap.gapDays,3);assert.equal(gap.dailyDeltaCybercab,null);
 assert.equal(rows[1].dailyDeltaCybercab,69);assert.equal(rows.at(-1).dailyDeltaCybercab,0);
});
