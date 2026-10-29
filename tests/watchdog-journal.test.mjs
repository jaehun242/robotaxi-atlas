import test from 'node:test';
import assert from 'node:assert/strict';
import {startWatchdogAttempt,completeWatchdogAttempt,validateJournal} from '../scripts/watchdog-journal.mjs';
const start='2026-10-29T23:23:00Z',empty={version:1,attempts:[]};
test('watchdog journals actual run attempts before collection, deduplicates a step and caps each KST day at two',()=>{
 const one=startWatchdogAttempt(empty,{id:'100:1',now:start});
 assert.equal(one.attempts[0].day,'2026-10-30');assert.equal(empty.attempts.length,0);
 assert.deepEqual(startWatchdogAttempt(one,{id:'100:1',now:'2026-10-30T00:00:00Z'}),one);
 const two=startWatchdogAttempt(one,{id:'100:2',now:'2026-10-30T00:23:00Z'});
 assert.throws(()=>startWatchdogAttempt(two,{id:'101:1',now:'2026-10-30T01:23:00Z'}),/2회/);
 const tomorrow=startWatchdogAttempt(two,{id:'102:1',now:'2026-10-30T23:23:00Z'});assert.equal(tomorrow.attempts.length,3);
 assert.equal(tomorrow.attempts[2].day,'2026-10-31');
});
test('invalid recovery logs, identifiers and pre-08:00 attempts cannot erase or bypass the budget',()=>{
 assert.throws(()=>validateJournal({attempts:[]}));
 assert.throws(()=>startWatchdogAttempt(empty,{id:'100:1',now:'2026-10-29T22:59:59Z'}),/8시/);
 assert.throws(()=>startWatchdogAttempt(empty,{id:'undefined:1',now:start}),/검증/);
 const one=startWatchdogAttempt(empty,{id:'100:1',now:start});
 assert.throws(()=>startWatchdogAttempt(one,{id:'100:1',now:'2026-10-30T23:23:00Z'}),/재사용/);
});
test('recovery completion records collection separately from deployment and never mutates source observations',()=>{
 const journal=startWatchdogAttempt(empty,{id:'100:1',now:start});
 const atlas={lastAttemptAt:start,runs:[{id:'daily-2026-10-30',state:'partial'}],observations:[{asOf:'2026-10-28',count:573}],news:[{firstCollectedAt:'2026-10-23'}]};
 const before=structuredClone(atlas);
 const done=completeWatchdogAttempt(journal,{id:'100:1',atlas,now:'2026-10-29T23:24:00Z'});
 assert.equal(done.attempts[0].state,'collected');assert.equal(done.attempts[0].deployment,undefined);assert.deepEqual(atlas,before);
 assert.equal(journal.attempts[0].completedAt,undefined);
 assert.deepEqual(completeWatchdogAttempt(done,{id:'100:1',atlas,now:'2026-10-30T00:23:00Z'}),done);
 const failed=completeWatchdogAttempt(journal,{id:'100:1',atlas:{...atlas,runs:[{id:'daily-2026-10-30',state:'failed'}]}});assert.equal(failed.attempts[0].state,'collection_failed');
 assert.throws(()=>completeWatchdogAttempt(journal,{id:'100:1',atlas:{...atlas,lastAttemptAt:'2026-10-28T23:00:00Z'}}),/수집 기록/);
});
