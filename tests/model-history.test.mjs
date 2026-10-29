import test from 'node:test';
import assert from 'node:assert/strict';
import { collectModelHistory, MODEL_HISTORY_URL, parseModelHistory } from '../scripts/model-history-lib.mjs';

const NOW = '2026-10-29T04:00:00Z';
const NEXT = '2026-10-30T04:00:00Z';
const fixture = () => ({ updated: '2026-10-28', daily: {
  dates: ['2026-06-09', '2026-10-05', '2026-10-28'],
  txTesla: [69, 589, 1080], txCybercab: [null, 169, 573], txModelY: [null, 420, 507],
} });
const fetchData = payload => async () => ({ ok: true, json: async () => payload });

// Sparse publisher data must stay sparse rather than backcasting today's split.
test('source model history keeps dates, missing models and explicit zero distinct', async () => {
  const data = fixture();
  data.daily.dates.push('2026-10-29');
  data.daily.txTesla.push(507); data.daily.txCybercab.push(0); data.daily.txModelY.push(507);
  const result = await collectModelHistory(null, { now: NOW, fetcher: fetchData(data) });
  assert.equal(result.checkState, 'ok');
  assert.equal(result.sourceId, 'tslafg');
  assert.equal(result.verification, 'unofficial');
  assert.equal(result.scope, 'US-TX');
  assert.equal(result.basis, 'registered');
  assert.equal(result.dateBasis, 'publisher_calendar');
  assert.equal(result.timezone, null);
  assert.equal(result.observations.length, 3);
  assert.equal(result.observations.find(p => p.date === '2026-06-09'), undefined);
  assert.equal(result.observations.at(-1).cybercab, 0);
  for (const row of result.observations) {
    assert.equal(row.observedAt, null); assert.equal(row.publishedAt, null);
    assert.equal(row.firstCollectedAt, NOW); assert.equal(row.lastCheckedAt, NOW);
  }
});

test('partial models stay null without deriving a split from total', async () => {
  const data = fixture(); data.daily.txCybercab[1] = null;
  const result = await collectModelHistory(null, { now: NOW, fetcher: fetchData(data) });
  assert.equal(result.checkState, 'ok');
  assert.equal(result.observations[0].cybercab, null);
  assert.equal(result.observations[0].model_y, 420);
});

test('parser rejects invalid dates, duplicates, missing arrays and unsafe counts', () => {
  const cases = [
    d => d.daily.dates[1] = '2026-02-30',
    d => d.daily.dates[1] = '2026-6-09',
    d => d.daily.dates[1] = d.daily.dates[0],
    d => d.daily.txCybercab.pop(),
    d => delete d.daily.txModelY,
    d => d.daily.txCybercab[1] = undefined,
    d => d.daily.txCybercab[1] = -1,
    d => d.daily.txCybercab[1] = 1.5,
    d => d.daily.txCybercab[1] = '169',
    d => d.daily.txTesla[1] = Number.MAX_SAFE_INTEGER + 1,
    d => d.daily.txTesla[1] = null,
    d => d.daily.txTesla[1] = 590,
    d => { d.daily.txCybercab[1] = null; d.daily.txModelY[1] = 590; },
  ];
  for (const mutate of cases) { const data = fixture(); mutate(data); assert.throws(() => parseModelHistory(data)); }
});

test('same-date retries deduplicate, dates outside rolling response survive and corrections are recorded once', async () => {
  const first = await collectModelHistory(null, { now: NOW, fetcher: fetchData(fixture()) });
  const repeat = await collectModelHistory(first, { now: NEXT, fetcher: fetchData(fixture()) });
  assert.equal(repeat.observations.length, 2); assert.equal(repeat.revisions.length, 0);
  assert.equal(repeat.observations[0].firstCollectedAt, NOW);
  assert.equal(repeat.observations[0].lastCheckedAt, NEXT);
  const rolled = { daily: { dates: ['2026-10-28'], txTesla: [1081], txCybercab: [574], txModelY: [507] } };
  const corrected = await collectModelHistory(repeat, { now: NEXT, fetcher: fetchData(rolled) });
  assert.equal(corrected.observations.length, 2);
  assert.deepEqual(corrected.observations[0], repeat.observations[0]);
  assert.equal(corrected.observations[1].firstCollectedAt, NOW);
  assert.equal(corrected.observations[1].cybercab, 574);
  assert.equal(corrected.revisions.length, 1);
  assert.deepEqual(corrected.revisions[0].previous, { cybercab: 573, model_y: 507, total: 1080 });
  assert.deepEqual(corrected.revisions[0].replacement, { cybercab: 574, model_y: 507, total: 1081 });
  const again = await collectModelHistory(corrected, { now: NEXT, fetcher: fetchData(rolled) });
  assert.equal(again.revisions.length, 1);
});

test('explicit publisher withdrawal removes obsolete model row and retains a correction record', async () => {
  const first = await collectModelHistory(null, { now: NOW, fetcher: fetchData(fixture()) });
  const data = fixture(); data.daily.txCybercab[1] = null; data.daily.txModelY[1] = null;
  const withdrawn = await collectModelHistory(first, { now: NEXT, fetcher: fetchData(data) });
  assert.equal(withdrawn.observations.length, 1);
  assert.equal(withdrawn.revisions.length, 1);
  assert.equal(withdrawn.revisions[0].date, '2026-10-05');
  assert.equal(withdrawn.revisions[0].replacement, null);
});

test('HTTP, parse and forced failures retain last good rows and success clock without retrying', async () => {
  const first = await collectModelHistory(null, { now: NOW, fetcher: fetchData(fixture()) });
  let calls = 0;
  const failed = await collectModelHistory(first, { now: NEXT, fetcher: async (url, options) => {
    calls++; assert.equal(url, MODEL_HISTORY_URL); assert.ok(options.signal);
    return { ok: false, status: 403 };
  } });
  assert.equal(calls, 1); assert.equal(failed.checkState, 'failed');
  assert.match(failed.error, /403/);
  assert.deepEqual(failed.observations, first.observations);
  assert.deepEqual(failed.revisions, first.revisions);
  assert.equal(failed.lastSuccessAt, NOW); assert.equal(failed.lastAttemptAt, NEXT);
  const invalid = fixture(); invalid.daily.txTesla[1] = 1;
  const malformed = await collectModelHistory(first, { now: NEXT, fetcher: fetchData(invalid) });
  assert.deepEqual(malformed.observations, first.observations);
  assert.equal(malformed.lastSuccessAt, NOW);
  const forced = await collectModelHistory(first, { now: NEXT, forceFailure: true,
    fetcher: async () => { throw Error('should never fetch'); } });
  assert.equal(forced.checkState, 'failed'); assert.deepEqual(forced.observations, first.observations);
  const empty = await collectModelHistory(null, { now: NOW, forceFailure: true });
  assert.deepEqual(empty.observations, []); assert.equal(empty.lastSuccessAt, null);
});
