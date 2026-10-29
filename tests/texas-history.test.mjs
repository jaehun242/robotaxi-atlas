import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTexasHistory, collectTexasHistory, TEXAS_HISTORY_SOURCE_ID} from '../scripts/texas-history-lib.mjs';

const NOW = '2026-10-29T04:30:00.000Z';
// Opaque synthetic fixture identifiers: no real vehicle identifiers in tests.
const A = 'synthetic-only-y-a';
const B = 'synthetic-only-y-b';
const C = 'synthetic-only-c-a';
const D = 'synthetic-only-unknown';
function fixture() {
  return {
    vehicles: [{vin: A, model: 'Model Y'}, {vin: B, model: 'MODEL Y'}, {vin: C, model: 'cybercab'}],
    history: [
      {timestamp: '2026-06-09T16:01:00Z', count: 1, vins: [A]},
      {timestamp: '2026-06-11T00:54:00Z', count: 2, vins: [A, B]},
      {timestamp: '2026-08-31T18:44:00Z', count: 3, vins: [A, B, C]}
    ]
  };
}
const success = data => async () => ({ok: true, status: 200, json: async () => structuredClone(data)});

test('only real snapshot days are returned; models derive from explicit classifications without filling gaps', () => {
  const rows = parseTexasHistory(fixture(), {now: NOW});
  assert.deepEqual(rows.map(row => [row.date, row.cybercab, row.model_y, row.total]), [
    ['2026-06-09', 0, 1, 1], ['2026-06-11', 0, 2, 2], ['2026-08-31', 1, 2, 3]
  ]);
  assert.equal(rows[0].sourceId, TEXAS_HISTORY_SOURCE_ID);
  assert.equal(rows[0].observedAt, '2026-06-09T16:01:00.000Z');
  assert.equal(rows[0].publishedAt, null);
  assert.equal(rows[0].firstCollectedAt, NOW);
  assert.equal(rows[0].snapshotHash.length, 64);
  for (const identifier of [A, B, C]) assert.ok(!JSON.stringify(rows).includes(identifier));
  assert.ok(!JSON.stringify(rows).includes('"vins"'));
});

test('UTC day uses the final actual snapshot timestamp, independently of input order and local date', () => {
  const data = fixture();
  data.history.push({timestamp: '2026-06-09T22:00:00Z', count: 2, vins: [A, B]});
  data.history.reverse();
  const rows = parseTexasHistory(data, {now: NOW});
  assert.equal(rows[0].model_y, 2);
  assert.equal(rows[0].observedAt, '2026-06-09T22:00:00.000Z');
  // 00:54 UTC stays June 11 even though Texas was still June 10.
  assert.equal(rows[1].date, '2026-06-11');
});

test('source-gap uncertainty is about registration occurrence date, not absence from observed snapshot', () => {
  const data = fixture();
  data.history[2].uncertainVins = [C];
  const row = parseTexasHistory(data, {now: NOW}).at(-1);
  assert.equal(row.cybercab, 1);
  assert.equal(row.total, 3);
  assert.match(row.note, /실제 등록일 미상/);
  assert.match(row.note, /최초 관측 1건/);
  assert.ok(!JSON.stringify(row).includes(C));
});

test('unmapped historical records and absent snapshot lists keep both models null; zero remains distinct', () => {
  const data = fixture();
  data.history[0] = {timestamp: '2026-06-09T16:01:00Z', count: 1, vins: [D]};
  data.history[1] = {timestamp: '2026-06-11T00:54:00Z', count: 2};
  data.history[2] = {timestamp: '2026-08-31T18:44:00Z', count: 0, vins: []};
  const rows = parseTexasHistory(data, {now: NOW});
  assert.deepEqual(rows.map(row => [row.cybercab, row.model_y, row.total]), [
    [null, null, 1], [null, null, 2], [0, 0, 0]
  ]);
});

test('unknown model labels are never guessed from identifiers or assigned to the largest model', () => {
  const data = fixture();
  data.vehicles[2].model = 'Unknown';
  const row = parseTexasHistory(data, {now: NOW}).at(-1);
  assert.equal(row.cybercab, null);
  assert.equal(row.model_y, null);
  assert.equal(row.total, 3);
});

test('invalid snapshot structure, duplicates, and future timestamps fail validation', () => {
  for (const mutate of [
    data => {data.history[0].vins = [A, A];},
    data => {data.history[0].count = -1;},
    data => {data.history[0].timestamp = 'invalid';},
    data => {data.history[0].timestamp = '2030-06-09T00:00:00Z';},
    data => {data.vehicles.push({vin: A, model: 'Cybercab'});}
  ]) {
    const data = fixture();
    mutate(data);
    assert.throws(() => parseTexasHistory(data, {now: NOW}));
  }
});

test('collection is idempotent, preserves initial collection time, and retains older snapshots when source window shrinks', async () => {
  const first = await collectTexasHistory(null, {now: NOW, fetcher: success(fixture())});
  const later = '2026-10-30T00:00:00.000Z';
  const second = await collectTexasHistory(first, {now: later, fetcher: success(fixture())});
  assert.equal(second.observations.length, 3);
  assert.equal(second.revisions.length, 0);
  assert.equal(second.observations[0].firstCollectedAt, NOW);
  assert.equal(second.observations[0].lastCheckedAt, later);
  assert.equal(second.observations[0].observedAt, first.observations[0].observedAt);
  const trimmed = fixture();
  trimmed.history = trimmed.history.slice(-1);
  const third = await collectTexasHistory(second, {now: later, fetcher: success(trimmed)});
  assert.equal(third.observations.length, 3);
  assert.deepEqual(third.observations[0], second.observations[0]);
  assert.equal(first.observations[0].lastCheckedAt, NOW);
});

test('corrections are tracked with aggregate before/after values without leaking identifiers', async () => {
  const first = await collectTexasHistory(null, {now: NOW, fetcher: success(fixture())});
  const corrected = fixture();
  corrected.history[0] = {...corrected.history[0], count: 2, vins: [A, B]};
  const second = await collectTexasHistory(first, {now: '2026-10-30T00:00:00.000Z', fetcher: success(corrected)});
  assert.equal(second.revisions.length, 1);
  assert.equal(second.revisions[0].previous.total, 1);
  assert.equal(second.revisions[0].replacement.total, 2);
  assert.equal(second.observations[0].firstCollectedAt, NOW);
  for (const identifier of [A, B, C]) assert.ok(!JSON.stringify(second).includes(identifier));
});

test('collection failure preserves last good values and source observation clocks', async () => {
  const first = await collectTexasHistory(null, {now: NOW, fetcher: success(fixture())});
  const failed = await collectTexasHistory(first, {now: '2026-10-30T00:00:00.000Z', forceFailure: true});
  assert.equal(failed.checkState, 'failed');
  assert.equal(failed.lastSuccessAt, NOW);
  assert.equal(failed.lastAttemptAt, '2026-10-30T00:00:00.000Z');
  assert.deepEqual(failed.observations, first.observations);
  assert.match(failed.error, /마지막 정상 기록/);
});

test('network retries are bounded and blocked sources are not retried', async () => {
  for (const [status, expectedCalls] of [[403, 1], [503, 2]]) {
    let calls = 0;
    const result = await collectTexasHistory(null, {now: NOW, fetcher: async (_url, options) => {
      calls++;
      assert.ok(options.signal instanceof AbortSignal);
      return {ok: false, status};
    }});
    assert.equal(calls, expectedCalls);
    assert.equal(result.checkState, 'failed');
    assert.deepEqual(result.observations, []);
  }
});


test('loss of a current model mapping does not erase a previously validated historical split', async () => {
  const first = await collectTexasHistory(null, {now: NOW, fetcher: success(fixture())});
  const reduced = fixture();
  reduced.vehicles = reduced.vehicles.filter(vehicle => vehicle.vin !== C);
  const later = '2026-10-30T00:00:00.000Z';
  const second = await collectTexasHistory(first, {now: later, fetcher: success(reduced)});
  assert.equal(second.observations.at(-1).cybercab, 1);
  assert.equal(second.observations.at(-1).model_y, 2);
  assert.equal(second.observations.at(-1).observedAt, first.observations.at(-1).observedAt);
  assert.equal(second.observations.at(-1).lastCheckedAt, later);
  assert.match(second.observations.at(-1).validationNote, /이전 검증/);
  assert.equal(second.revisions.length, 0);
});

test('changed membership at the same timestamp and total is a real correction, not mapping loss', async () => {
  const first = await collectTexasHistory(null, {now: NOW, fetcher: success(fixture())});
  const corrected = fixture();
  corrected.history[2].vins = [A, B, D];
  const second = await collectTexasHistory(first, {now: NOW, fetcher: success(corrected)});
  assert.equal(second.observations.at(-1).cybercab, null);
  assert.equal(second.revisions.length, 1);
  assert.notEqual(second.observations.at(-1).snapshotMembershipHash, first.observations.at(-1).snapshotMembershipHash);
  for (const identifier of [A, B, C, D]) assert.ok(!JSON.stringify(second).includes(identifier));
});

function closedSnapshotFixture() {
  return {
    vehicles: [{vin:A,model:'Model Y'},{vin:C,model:'Cybercab'}],
    history: [
      {timestamp:'2026-07-15T20:42:31.732Z',count:2,vins:[A,D]},
      {timestamp:'2026-07-30T02:26:59.847Z',count:3,vins:[A,D,C]}
    ]
  };
}
const closedEvidence = [{
  id:'synthetic-all-y-proof',scope:'US-TX',basis:'registered',
  anchorObservedAt:'2026-07-15T20:42:31.732Z',anchorTotal:2,
  model:'model_y',allVehiclesModel:true,maxMissingModels:1,
  sourceUrl:'https://example.test/dated-model-evidence',
  publishedAt:'2026-07-16T09:15:00Z',statement:'Synthetic closed snapshot is explicitly all Model Y.'
}];
test('one absent fixed model is derived only from an exact complete single-model evidence anchor',()=>{
  const d=closedSnapshotFixture();
  const out=parseTexasHistory(d,{now:NOW,modelEvidence:closedEvidence});
  assert.deepEqual(out.map(o=>[o.cybercab,o.model_y,o.total]),[[0,2,2],[1,2,3]]);
  assert.ok(out.every(o=>o.derivedModelCount===1));
  assert.equal(out[0].modelEvidence[0].anchorTotal,2);
  assert.equal(out[0].modelEvidence[0].verification,'unofficial');
  assert.equal(out[0].modelEvidence[0].sourceUrl,closedEvidence[0].sourceUrl);
  for(const id of [A,C,D])assert.ok(!JSON.stringify(out).includes(id));
  assert.equal(parseTexasHistory(d,{now:NOW})[0].model_y,null);
});
test('wrong anchor timestamp/count, multiple missing models and contradictory explicit labels reject the closed deduction',()=>{
  for(const mutate of [
    (d,e)=>{e[0].anchorTotal=3;},
    (d,e)=>{e[0].anchorObservedAt='2026-07-15T20:42:32.732Z';},
    (d,e)=>{d.history[0].vins=[A,D,'another-synthetic-missing'];d.history[0].count=3;e[0].anchorTotal=3;},
    (d)=>{d.vehicles[0].model='Cybercab';},
    (d)=>{d.vehicles.push({vin:D,model:'Model 3'});},
    (_d,e)=>{e[0].allVehiclesModel=false;},
    (_d,e)=>{e[0].sourceUrl='';}
  ]){
    const d=closedSnapshotFixture(),e=structuredClone(closedEvidence);mutate(d,e);
    const row=parseTexasHistory(d,{now:NOW,modelEvidence:e})[0];
    assert.equal(row.model_y,null);assert.equal(row.cybercab,null);
    assert.equal(row.derivedModelCount,undefined);
  }
});
test('derived counts are idempotent, retain provenance and survive unavailable evidence without relabeling the past',async()=>{
  const data=closedSnapshotFixture();
  const first=await collectTexasHistory(null,{now:NOW,fetcher:success(data),modelEvidence:closedEvidence});
  const later='2026-10-30T00:00:00Z';
  const second=await collectTexasHistory(first,{now:later,fetcher:success(data),modelEvidence:closedEvidence});
  assert.equal(second.checkState,'ok');assert.equal(second.revisions.length,0);
  assert.equal(second.observations[0].firstCollectedAt,NOW);
  assert.deepEqual(second.observations[0].modelEvidence,first.observations[0].modelEvidence);
  const noProof=await collectTexasHistory(second,{now:later,fetcher:success(data),modelEvidence:[]});
  assert.equal(noProof.observations[0].model_y,2);
  assert.deepEqual(noProof.observations[0].modelEvidence,first.observations[0].modelEvidence);
  assert.equal(noProof.revisions.length,0);
  const failed=await collectTexasHistory(second,{now:later,forceFailure:true,modelEvidence:closedEvidence});
  assert.deepEqual(failed.observations,second.observations);
});
test('a current explicit contradiction prevents silently preserving an earlier closed-set deduction',async()=>{
  const data=closedSnapshotFixture();
  const first=await collectTexasHistory(null,{now:NOW,fetcher:success(data),modelEvidence:closedEvidence});
  data.vehicles[0].model='Cybercab';
  const next=await collectTexasHistory(first,{now:'2026-10-30T00:00:00Z',fetcher:success(data),modelEvidence:closedEvidence});
  assert.equal(next.observations[0].model_y,null);assert.equal(next.observations[0].modelEvidenceConflict,true);
  assert.ok(next.revisions.length>0);
});
