import {kstDay} from './domain.mjs';
import {registrationDailyChanges} from './fleet-changes.mjs';
const previousDay=day=>new Date(Date.parse(day+'T00:00:00Z')-86400000).toISOString().slice(0,10);
function calendar(points,period,end){
 if(!points.length)return [];
 const first=points.map(p=>p.day).sort()[0];
 const start=period==='all'?first:new Date(Date.parse(end+'T00:00:00Z')-(Number(period)-1)*86400000).toISOString().slice(0,10);
 const byDay=new Map(points.map(p=>[p.day,p])),out=[];
 for(let at=Date.parse(start+'T00:00:00Z');at<=Date.parse(end+'T00:00:00Z');at+=86400000){const day=new Date(at).toISOString().slice(0,10);out.push(byDay.get(day)??{day,total:null,cybercab:null,model_y:null,deltaTotal:null,dailyDeltaCybercab:null,dailyDeltaModelY:null,dailyDeltaTotal:null,missing:true});}
 return out;
}
export function archiveTimeline(archive,period='all'){
 const points=(archive?.points??[]).map(p=>({...p,day:p.date,cybercab:null,model_y:null})).sort((a,b)=>a.day.localeCompare(b.day)),map=new Map(points.map(p=>[p.day,p]));
 const rows=points.map(p=>{const prev=map.get(previousDay(p.day));return {...p,missing:p.total===null,deltaTotal:p.total!==null&&prev?.total!==null&&prev?.total!==undefined?p.total-prev.total:null};});
 return calendar(rows,period,points.at(-1)?.day);
}
export function officialTimeline(history,period='all',now=new Date().toISOString()){
 // Preserve the original comparison metadata, but only adjacent KST calendar days
 // qualify for a daily bar. Intraday changes and multi-day gaps stay separate.
 const points=registrationDailyChanges(history).map(p=>({...p,missing:false,dailyDeltaCybercab:p.gapDays===1?p.deltaCybercab:null,dailyDeltaModelY:p.gapDays===1?p.deltaModelY:null,dailyDeltaTotal:p.gapDays===1?p.deltaTotal:null}));
 return calendar(points,period,kstDay(now));
}
export function filterChangePeriod(events,period='all',endDay=kstDay(new Date())){
 if(period==='all')return events;
 const start=new Date(Date.parse(endDay+'T00:00:00Z')-(Number(period)-1)*86400000).toISOString().slice(0,10);
 return events.filter(e=>kstDay(e.checkedAt)>=start&&kstDay(e.checkedAt)<=endDay);
}
