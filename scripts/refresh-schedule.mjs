import {appendFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {kstDay} from '../src/domain.mjs';
import {validateJournal} from './watchdog-journal.mjs';

const morningStart=now=>Date.parse(`${kstDay(now)}T08:00:00+09:00`);
function watchdogBudget(decision,{now,mode,journal,runId}){
 if(mode!=='watchdog'||!decision.refresh||journal==null)return decision;
 try{validateJournal(journal);}catch{return {refresh:false,reason:'자동 복구 기록 확인 불가 · 기존 데이터 보존'};}
 const ids=new Set(journal.attempts.filter(a=>a.day===kstDay(now)).map(a=>a.id));
 // A repeated script call in the same workflow attempt resumes its own entry.
 // GitHub reruns use a new run-attempt key and consume a separate attempt.
 if(ids.size>=2&&(!runId||!ids.has(runId)))return {refresh:false,reason:'오늘 자동 복구 2회 한도 도달 · 다음 한국 날짜에 재시도'};
 return decision;
}

// Inspect the deployed site, not just a data commit: a failed build must be retried.
export function refreshDecision(published,{now=new Date().toISOString(),event='schedule',mode='daily',journal,runId}={}){
 if(mode!=='watchdog'&&event!=='schedule')return {refresh:true,reason:'push 또는 수동 실행은 즉시 갱신'};
 const today=kstDay(now),start=morningStart(now),attempt=Date.parse(published?.lastAttemptAt);
 if(mode==='watchdog'&&Date.parse(now)<start)return {refresh:false,reason:'한국시간 오전 8시 이전 · 일일 자동 복구 대기'};
 let reason='';
 if(!Number.isFinite(attempt)||kstDay(attempt)!==today||attempt<start||attempt>Date.parse(now))reason='오늘 오전 8시 이후 공개된 갱신 기록 없음';
 else{
  const run=Array.isArray(published?.runs)?published.runs.find(r=>r?.id===`daily-${today}`):null;
  if(!run||!['success','partial'].includes(run.state))reason='오늘 수집 실패 또는 실행 기록 미확인 · 보완 실행';
 }
 if(!reason)return {refresh:false,reason:'오늘 오전 8시 이후 갱신 결과가 이미 공개됨 · 중복 실행 생략'};
 return watchdogBudget({refresh:true,reason},{now,mode,journal,runId});
}

export async function checkPublishedRefresh({fetcher=fetch,now=new Date().toISOString(),event='schedule',mode='daily',journal,runId}={}){
 const options={now,event,mode,journal,runId};
 // An hourly registry run must never perform daily recovery before 08:00 KST,
 // including manually dispatched registry runs. No public-site request is needed.
 if(mode==='watchdog'&&Date.parse(now)<morningStart(now))return refreshDecision(null,options);
 if(mode!=='watchdog'&&event!=='schedule')return refreshDecision(null,options);
 try{
  const response=await fetcher('https://jaehun242.github.io/robotaxi-atlas/data/atlas.json?health='+Date.parse(now),{signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  return refreshDecision(await response.json(),options);
 }catch{return watchdogBudget({refresh:true,reason:'공개 갱신 상태 조회 실패 · 안전하게 수집·재배포 시도'},options);}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const mode=process.argv.includes('--watchdog')?'watchdog':'daily';
 let journal;
 if(mode==='watchdog')try{journal=JSON.parse(await readFile('data/automation-watchdog.json','utf8'));}catch(error){if(error.code!=='ENOENT')journal={invalid:true};}
 const runId=process.env.GITHUB_RUN_ID?`${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT??'1'}`:undefined;
 const decision=await checkPublishedRefresh({event:process.env.GITHUB_EVENT_NAME??'workflow_dispatch',mode,journal,runId});
 if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`refresh=${decision.refresh}\nreason=${decision.reason}\n`);
 console.log(JSON.stringify(decision));
}
