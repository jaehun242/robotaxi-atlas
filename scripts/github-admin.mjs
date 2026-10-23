// Maintainer CLI. Uses the operating system's existing Git credential manager.
// Credentials stay in memory and are never logged or written to the repository.
import { spawnSync } from 'node:child_process';
const filled=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}});
if(filled.status!==0) throw new Error('GitHub 공식 로그인이 필요합니다. 저장된 인증 정보를 읽지 못했습니다.');
const fields=Object.fromEntries(filled.stdout.trim().split(/\r?\n/).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
if(!fields.password) throw new Error('GitHub 인증 정보를 찾지 못했습니다.');
const [method='GET',path='/repos/jaehun242/robotaxi-atlas',body]=process.argv.slice(2);
if(!path.startsWith('/repos/jaehun242/robotaxi-atlas')) throw new Error('이 프로젝트 저장소 경로만 허용합니다.');
const response=await fetch(`https://api.github.com${path}`,{method,headers:{Authorization:`Bearer ${fields.password}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'robotaxi-atlas-maintainer',...(body?{'Content-Type':'application/json'}:{})},body:body||undefined});
const data=await response.text();
let payload=null;try{payload=data?JSON.parse(data):null;}catch{payload=data;}
console.log(JSON.stringify({status:response.status,scopes:response.headers.get('x-oauth-scopes'),data:payload}));
if(!response.ok) process.exitCode=1;
