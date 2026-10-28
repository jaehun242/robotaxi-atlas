import {useCallback,useEffect,useRef,useState} from 'react';
import {refreshPublishedData} from './published-data.mjs';
import type {Dataset} from './types';
import type {Statistics,ScenarioDataset} from './market-types';
import type {MonitoringDataset} from './monitoring-types';
type Bundle={atlas?:Dataset;statistics?:Statistics;scenarios?:ScenarioDataset;monitoring?:MonitoringDataset};
export function usePublishedData(){
 const [bundle,setBundle]=useState<Bundle>({}),[loadError,setLoadError]=useState(''),[refreshing,setRefreshing]=useState(false);
 const current=useRef<Bundle>({}),pending=useRef(false),lastStart=useRef(0);
 const load=useCallback(async(force=false)=>{
  if(pending.current||!force&&Date.now()-lastStart.current<10000)return;
  pending.current=true;lastStart.current=Date.now();setRefreshing(true);
  try{
   const result=await refreshPublishedData(current.current,{baseUrl:import.meta.env.BASE_URL});
   current.current=result.data;setBundle(result.data);
   setLoadError(result.failed.length?'일부 게시 데이터를 읽지 못했습니다. 마지막으로 불러온 자료를 유지합니다.':'');
  }finally{pending.current=false;setRefreshing(false);}
 },[]);
 useEffect(()=>{
  void load();const focus=()=>{if(document.visibilityState==='visible')void load();};
  const timer=setInterval(focus,5*60*1000);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  return()=>{clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
 },[load]);
 return {real:bundle.atlas??null,statistics:bundle.statistics??null,scenarios:bundle.scenarios??null,monitoring:bundle.monitoring??null,loadError,refreshing,load};
}
