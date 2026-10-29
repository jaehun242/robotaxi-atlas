import {collectMyCybercab,MYCYBERCAB_URL} from './mycybercab-lib.mjs';
export async function collectCityClaims(data,options={}){
 const next=structuredClone(data),now=options.now??new Date().toISOString(),sourceId='mycybercab-austin';
 const previous=next.cityFleetClaims?.find(c=>c.sourceId===sourceId),claim=await collectMyCybercab(previous,{...options,now});
 next.cityFleetClaims=[...(next.cityFleetClaims??[]).filter(c=>c.sourceId!==sourceId),claim];
 if(!next.sources.some(s=>s.id===sourceId))next.sources.push({id:sourceId,name:'MyCybercab · 오스틴 Cybercab 표기',url:MYCYBERCAB_URL,priority:3,access:'public HTML',definition:'사용자가 선택한 Austin fleet claim. +는 하한 표기. 공식 직접 확인·주 등록부·커뮤니티 명부와 별도이며 다른 차종과 합산하지 않음.',automation:'매일 08:00 및 매시간 공개 카드 확인 · 실패 시 원래 수치·기준일 유지'});
 next.sourceRuns=[...next.sourceRuns.filter(r=>r.sourceId!==sourceId),{sourceId,state:claim.checkState==='ok'?'ok':'failed',checkedAt:now,lastSuccessAt:claim.lastSuccessAt??null,message:claim.checkState==='ok'?'Austin fleet claim '+claim.displayCount+' · 원문 '+(claim.sourceAsOf??'기준일 미공개')+' · 주 등록 총계·Model Y와 별도.':claim.error}];
 return next;
}
