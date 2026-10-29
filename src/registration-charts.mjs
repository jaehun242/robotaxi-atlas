import {kstDay} from './domain.mjs';
import {registrationDailyChanges} from './fleet-changes.mjs';
const previousDay=day=>new Date(Date.parse(day+'T00:00:00Z')-86400000).toISOString().slice(0,10);
function calendar(points,period,end){
 if(!points.length)return [];
 const first=points.map(p=>p.day).sort()[0];
 const start=period==='all'?first:new Date(Date.parse(end+'T00:00:00Z')-(Number(period)-1)*86400000).toISOString().slice(0,10);
 const byDay=new Map(points.map(p=>[p.day,p])),out=[];
 for(let at=Date.parse(start+'T00:00:00Z');at<=Date.parse(end+'T00:00:00Z');at+=86400000){const day=new Date(at).toISOString().slice(0,10);out.push(byDay.get(day)??{day,total:null,cybercab:null,model_y:null,deltaTotal:null,deltaCybercab:null,deltaModelY:null,dailyDeltaCybercab:null,dailyDeltaModelY:null,dailyDeltaTotal:null,missing:true});}
 return out;
}
export function archiveTimeline(archive,period='all'){
 const points=(archive?.points??[]).map(p=>({...p,day:p.date,cybercab:null,model_y:null})).sort((a,b)=>a.day.localeCompare(b.day)),map=new Map(points.map(p=>[p.day,p]));
 const rows=points.map(p=>{const prev=map.get(previousDay(p.day));return {...p,missing:p.total===null,deltaTotal:p.total!==null&&prev?.total!==null&&prev?.total!==undefined?p.total-prev.total:null};});
 return calendar(rows,period,points.at(-1)?.day);
}
export function officialTimeline(history,period='all',now=new Date().toISOString()){
 // Preserve the original comparison metadata, but only adjacent KST calendar days
 // qualify for a daily change point. Intraday changes and multi-day gaps stay separate.
 const points=registrationDailyChanges(history).map(p=>({...p,missing:false,dailyDeltaCybercab:p.gapDays===1?p.deltaCybercab:null,dailyDeltaModelY:p.gapDays===1?p.deltaModelY:null,dailyDeltaTotal:p.gapDays===1?p.deltaTotal:null}));
 return calendar(points,period,kstDay(now));
}
export function filterChangePeriod(events,period='all',endDay=kstDay(new Date())){
 if(period==='all')return events;
 const start=new Date(Date.parse(endDay+'T00:00:00Z')-(Number(period)-1)*86400000).toISOString().slice(0,10);
 return events.filter(e=>kstDay(e.checkedAt)>=start&&kstDay(e.checkedAt)<=endDay);
}
// Plot coordinates preserve elapsed time. Missing values remain absent observations.
export function fleetLinePoints(rows,field,{log=false,publisherDates=false}={}){
 const times=rows.map(r=>Date.parse(r.day+'T00:00:00'+(publisherDates?'Z':'+09:00')));
 const raw=rows.map(r=>typeof r[field]==='number'&&Number.isFinite(r[field])?r[field]:null);
 const values=raw.map(v=>log&&v!==null&&v<=0?null:v);
 const gaps=[];let previous=null;
 for(let i=0;i<raw.length;i++){
  if(raw[i]===null)continue;
  if(previous!==null&&values[previous]!==null&&values[i]!==null&&times[i]-times[previous]>86400000){
   gaps.push({start:previous,end:i,days:Math.round((times[i]-times[previous])/86400000)});
  }
  previous=i;
 }
 return {times,raw,values,gaps,excluded:raw.filter(v=>log&&v!==null&&v<=0).length};
}
