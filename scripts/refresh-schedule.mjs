import {appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {kstDay} from '../src/domain.mjs';

// Inspect the deployed site, not just a data commit: a failed build must be retried.
export function refreshDecision(published,{now=new Date().toISOString(),event='schedule'}={}){
 if(event!=='schedule')return {refresh:true,reason:'push 또는 수동 실행은 즉시 갱신'};
 const today=kstDay(now),start=Date.parse(`${today}T08:00:00+09:00`),attempt=Date.parse(published?.lastAttemptAt);
 if(!Number.isFinite(attempt)||kstDay(attempt)!==today||attempt<start||attempt>Date.parse(now))return {refresh:true,reason:'오늘 오전 8시 이후 공개된 갱신 기록 없음'};
 const run=published?.runs?.find(r=>r.id===`daily-${today}`);
 if(!run||!['success','partial'].includes(run.state))return {refresh:true,reason:'오늘 수집 실패 또는 실행 기록 미확인 · 보완 실행'};
 return {refresh:false,reason:'오늘 오전 8시 이후 갱신 결과가 이미 공개됨 · 중복 실행 생략'};
}

export async function checkPublishedRefresh({fetcher=fetch,now=new Date().toISOString(),event='schedule'}={}){
 if(event!=='schedule')return refreshDecision(null,{now,event});
 try{
  const response=await fetcher('https://jaehun242.github.io/robotaxi-atlas/data/atlas.json?health='+Date.parse(now),{signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  return refreshDecision(await response.json(),{now,event});
 }catch{return {refresh:true,reason:'공개 갱신 상태 조회 실패 · 안전하게 수집·재배포 시도'};}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const decision=await checkPublishedRefresh({event:process.env.GITHUB_EVENT_NAME??'workflow_dispatch'});
 if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`refresh=${decision.refresh}\nreason=${decision.reason}\n`);
 console.log(JSON.stringify(decision));
}
