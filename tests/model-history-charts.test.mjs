import test from 'node:test';
import assert from 'node:assert/strict';
import {modelSeries,modelConflicts,historicalModelSources} from '../src/model-history-charts.mjs';
const sources=[{sourceId:'a',name:'Archive',verification:'unofficial',observations:[{date:'2026-06-09',cybercab:null,model_y:59,total:59},{date:'2026-06-11',cybercab:null,model_y:69,total:69},{date:'2026-06-12',cybercab:null,model_y:69,total:69}]},{sourceId:'b',name:'Direct',verification:'official_single',observations:[{date:'2026-06-11',cybercab:0,model_y:70,total:70}]}];
test('historical model gaps and grade stay separate; zero remains observed',()=>{
 const s=modelSeries(sources,{end:'2026-06-12'});assert.equal(s.length,4);assert.deepEqual(s[1].rows.map(r=>r.value),[59,null,69,69]);assert.equal(s[2].rows[2].value,0);assert.equal(s[0].rows[0].value,null);
 assert.equal(modelSeries(sources,{end:'2026-06-12',verifiedOnly:true}).length,2);
 assert.equal(modelSeries(sources,{end:'2026-06-12',model:'model_y'}).length,2);
});
test('daily changes require adjacent dates in the same source and model',()=>{
 const s=modelSeries(sources,{end:'2026-06-12',model:'model_y',view:'daily'});assert.deepEqual(s[0].rows.map(r=>r.value),[null,null,null,0]);assert.ok(s[1].rows.every(r=>r.value===null));
});
test('conflicting snapshots remain distinct rather than averaged or maximized',()=>{
 const c=modelConflicts(sources);assert.equal(c.length,1);assert.equal(c[0].date,'2026-06-11');assert.deepEqual(c[0].observations.map(o=>o.model_y),[69,70]);
});
test('reviewed source metadata is preserved and unknown models never inherit totals',()=>{
 const out=historicalModelSources({sources:[{id:'a',name:'Article',verification:'unofficial'}],observations:[{sourceId:'a',date:'2026-06-09',total:69,cybercab:null,model_y:null}]});
 assert.equal(out.length,1);assert.equal(modelSeries(out,{end:'2026-06-09'})[1].rows[0].value,null);
});

test('reviewed historical evidence has valid sources, dates, units and no invented model split',async()=>{
 const {readFile}=await import('node:fs/promises');
 const d=JSON.parse(await readFile(new URL('../public/data/model-history-reviewed.json',import.meta.url),'utf8'));
 assert.equal(d.scope,'US-TX');assert.equal(d.basis,'registered');
 const ids=new Set(d.sources.map(s=>s.id));assert.equal(ids.size,d.sources.length);
 const keys=new Set();
 for(const s of d.sources){assert.equal(s.verification,'unofficial');assert.match(s.url,/^https:\/\//);assert.ok(s.methodology);}
 for(const o of d.observations){assert.ok(ids.has(o.sourceId));assert.ok(!keys.has(o.sourceId+o.date));keys.add(o.sourceId+o.date);assert.match(o.date,/^20\d{2}-\d{2}-\d{2}$/);assert.equal(new Date(o.date).toISOString().slice(0,10),o.date);assert.ok(o.date>='2026-06-09');assert.ok(o.firstCollectedAt);for(const v of [o.cybercab,o.model_y,o.total])assert.ok(v===null||Number.isSafeInteger(v)&&v>=0);if(o.cybercab!==null&&o.model_y!==null)assert.equal(o.cybercab+o.model_y,o.total);assert.ok(o.note);}
 const first=d.observations.find(o=>o.date==='2026-06-11');assert.equal(first.model_y,69);assert.equal(first.cybercab,null);
});

