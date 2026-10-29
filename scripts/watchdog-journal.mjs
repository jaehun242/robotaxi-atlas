import {readFile,writeFile,rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {kstDay} from '../src/domain.mjs';
const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const validId=value=>typeof value==='string'&&/^[0-9]+:[1-9][0-9]*$/.test(value);
export function validateJournal(journal){
 if(journal?.version!==1||!Array.isArray(journal.attempts))throw Error('복구 실행 기록 형식 변경 · 자동 수집을 시작하지 않습니다');
 for(const a of journal.attempts)if(!validId(a.id)||!/^\d{4}-\d{2}-\d{2}$/.test(a.day)||!validTime(a.startedAt)||kstDay(a.startedAt)!==a.day)throw Error('복구 실행 기록 검증 실패 · 기존 파일 보존');
 return journal;
}
export function startWatchdogAttempt(journal,{id,now=new Date().toISOString()}={}){
 validateJournal(journal);
 if(!validId(id)||!validTime(now))throw Error('GitHub 실행 ID 또는 시각 검증 실패');
 const day=kstDay(now);
 if(Date.parse(now)<Date.parse(day+'T08:00:00+09:00'))throw Error('오전 8시 전에는 일일 복구 수집을 시작하지 않습니다');
 const previous=journal.attempts.find(a=>a.id===id);
 if(previous){if(previous.day!==day)throw Error('다른 날짜의 실행 ID 재사용 금지');return structuredClone(journal);}
 if(new Set(journal.attempts.filter(a=>a.day===day).map(a=>a.id)).size>=2)throw Error('오늘 일일 자동 복구 2회 한도에 도달했습니다');
 const next=structuredClone(journal);
 next.attempts.push({id,day,startedAt:now,kind:'hourly_daily_recovery',state:'started'});
 return next;
}
export function completeWatchdogAttempt(journal,{id,atlas,now=new Date().toISOString()}={}){
 validateJournal(journal);
 const next=structuredClone(journal),attempt=next.attempts.find(a=>a.id===id);
 if(!attempt)throw Error('시작 기록 없는 복구 완료 처리 금지');
 if(attempt.completedAt)return next;
 const daily=atlas?.runs?.find(r=>r.id==='daily-'+attempt.day);
 if(!daily||!validTime(atlas?.lastAttemptAt)||kstDay(atlas.lastAttemptAt)!==attempt.day)throw Error('해당 날짜의 전체 수집 기록이 없습니다');
 attempt.completedAt=now;attempt.collectionState=daily.state;
 attempt.state=['success','partial'].includes(daily.state)?'collected':'collection_failed';
 attempt.dataLastAttemptAt=atlas.lastAttemptAt;
 // This is collection completion, never a claim that Pages deployment succeeded.
 return next;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const path='data/automation-watchdog.json';
 let journal;try{journal=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;journal={version:1,attempts:[]};}
 const id=process.env.GITHUB_RUN_ID+':'+(process.env.GITHUB_RUN_ATTEMPT??'1');
 const next=process.argv.includes('--complete')?completeWatchdogAttempt(journal,{id,atlas:JSON.parse(await readFile('public/data/atlas.json','utf8'))}):startWatchdogAttempt(journal,{id});
 await writeFile(path+'.tmp',JSON.stringify(next,null,2)+'\n');await rename(path+'.tmp',path);
 console.log(JSON.stringify(next.attempts.find(a=>a.id===id)));
}
