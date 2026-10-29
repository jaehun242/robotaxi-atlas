import {useEffect,useRef,useState} from 'react';
import maplibregl, {type Map as GLMap} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Plus,Minus,LocateFixed} from 'lucide-react';
import type {City,Filters,Dataset} from './types';
import {latest,aggregate} from './domain.mjs';
import {US_REGIONS} from './us-regions';

const mainlandBounds:[[number,number],[number,number]]=[[-126,24],[-66,50.5]];
const compactBelow=4;
export default function AtlasMap({data,cities,filters,onNavigate,reduceMotion}:{data:Dataset;cities:City[];filters:Filters;onNavigate:(f:Partial<Filters>)=>void;reduceMotion:boolean}) {
  const host=useRef<HTMLDivElement>(null),map=useRef<GLMap|null>(null),markers=useRef<maplibregl.Marker[]>([]);
  const [ready,setReady]=useState(false),[error,setError]=useState('');
  const callback=useRef(onNavigate);callback.current=onNavigate;
  useEffect(()=>{
    if(!host.current)return;let m:GLMap|undefined,resize:ResizeObserver|undefined;
    try{
      m=new maplibregl.Map({container:host.current,style:{version:8,sources:{states:{type:'geojson',data:`${import.meta.env.BASE_URL}geo/us-states.json`}},layers:[
        {id:'background',type:'background',paint:{'background-color':'#080f1c'}},
        {id:'states-fill',type:'fill',source:'states',filter:['in',['get','name'],['literal',US_REGIONS.map(r=>r.name)]],paint:{'fill-color':'#1c3043','fill-opacity':.95}},
        {id:'selected-state',type:'fill',source:'states',filter:['==',['get','name'],''],paint:{'fill-color':'#6a9096','fill-opacity':.3}},
        {id:'states-lines',type:'line',source:'states',filter:['in',['get','name'],['literal',US_REGIONS.map(r=>r.name)]],paint:{'line-color':'#496079','line-width':.8}}
      ]},center:[-98,39],zoom:2.6,minZoom:1,maxZoom:10,attributionControl:false,renderWorldCopies:false});
      map.current=m;
      m.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'U.S. Census Bureau | 도시 중심 위치'}));
      m.on('load',()=>setReady(true));
      m.on('zoom',()=>markers.current.forEach(marker=>{const el=marker.getElement();el.classList.toggle('compact',el.dataset.dense==='true'&&m!.getZoom()<compactBelow);}));
      m.on('error',e=>{if(/WebGL|Failed to fetch|AJAXError/i.test(e.error?.message??''))setError('지도를 표시할 수 없습니다. 주·도시 필터로 탐색해 주세요.');});
      m.on('click','states-fill',e=>{const name=e.features?.[0]?.properties?.name,region=US_REGIONS.find(r=>r.name===name)?.code;if(region)callback.current({country:'US',region,city:''});});
      m.on('mouseenter','states-fill',()=>{m!.getCanvas().style.cursor='pointer';});
      m.on('mouseleave','states-fill',()=>{m!.getCanvas().style.cursor='';});
      resize=new ResizeObserver(()=>m?.resize());resize.observe(host.current);
    }catch{setError('WebGL을 사용할 수 없습니다. 주·도시 필터로 탐색해 주세요.');}
    return()=>{resize?.disconnect();markers.current.forEach(x=>x.remove());markers.current=[];m?.remove();map.current=null;};
  },[]);
  useEffect(()=>{
    if(!ready||!map.current)return;
    markers.current.forEach(x=>x.remove());
    markers.current=cities.filter(c=>c.country==='US').map(c=>{
      const sum=aggregate(latest(data,{...filters,country:'US',city:c.id})),services=data.services.filter(s=>s.city===c.id&&(!filters.model||s.model===filters.model));
      const active=services.some(s=>['commercial','limited'].includes(s.status));
      const el=document.createElement('button');el.className=`city-marker ${filters.city===c.id?'selected':''} ${active?'active':'unknown'}`;
      el.dataset.dense=String(['dallas','houston','miami','tampa','orlando'].includes(c.id)&&filters.city!==c.id);
      el.classList.toggle('compact',el.dataset.dense==='true'&&map.current!.getZoom()<compactBelow);
      el.setAttribute('aria-label',`${c.name} 도시 상세`);
      const dot=document.createElement('span');dot.className='marker-dot';
      const label=document.createElement('span');label.className='marker-label';label.textContent=c.english;
      const value=document.createElement('em');value.textContent=sum.total===null?'미확인':`${sum.total.toLocaleString()}대`;
      label.append(value);el.append(dot,label);
      el.onclick=e=>{e.stopPropagation();callback.current({country:'US',region:c.region,city:c.id});};
      return new maplibregl.Marker({element:el,anchor:'left'}).setLngLat(c.coordinates).addTo(map.current!);
    });
  },[ready,cities,data,filters]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    const city=data.cities.find(c=>c.id===filters.city&&c.country==='US'),selected=US_REGIONS.find(r=>r.code===(city?.region??filters.region)),duration=reduceMotion?0:850;
    m.setFilter('selected-state',['==',['get','name'],selected?.name??'']);
    if(city)m.flyTo({center:city.coordinates,zoom:4.7,duration});
    else if(selected?.bounds){const [west,south,east,north]=selected.bounds;m.fitBounds([[west,south],[east,north]],{padding:50,duration,maxZoom:7});}
    else m.fitBounds(mainlandBounds,{padding:{top:70,right:32,bottom:72,left:32},duration,maxZoom:4.2});
  },[ready,filters.country,filters.region,filters.city,reduceMotion,data.cities]);
  const reset=()=>onNavigate({country:'US',region:'',city:''});
  return <div className="map-shell us-map-shell"><div ref={host} className="map" aria-label="미국 50개 주와 워싱턴 D.C.를 탐색하는 지도"/>{error&&<div className="map-error">{error}</div>}
    <div className="us-map-shortcuts" role="group" aria-label="미국 지도 빠른 이동">
      <button className={!filters.region&&!filters.city?'active':''} aria-pressed={!filters.region&&!filters.city} onClick={reset}>미국 본토</button>
      <button className={filters.region==='AK'?'active':''} aria-pressed={filters.region==='AK'} onClick={()=>onNavigate({country:'US',region:'AK',city:''})}>알래스카</button>
      <button className={filters.region==='HI'?'active':''} aria-pressed={filters.region==='HI'} onClick={()=>onNavigate({country:'US',region:'HI',city:''})}>하와이</button>
    </div>
    <div className="map-controls"><button aria-label="지도 확대" onClick={()=>map.current?.zoomIn({duration:reduceMotion?0:300})}><Plus size={17}/></button><button aria-label="지도 축소" onClick={()=>map.current?.zoomOut({duration:reduceMotion?0:300})}><Minus size={17}/></button><button aria-label="미국 전체 보기" onClick={reset}><LocateFixed size={17}/></button></div>
    <div className="map-key"><span><i className="dot teal"/>서비스 확인</span><span><i className="dot muted"/>확인할 수 없음</span></div><div className="map-caption">마커는 도시 대표 위치입니다. 서비스 경계·개별 차량 GPS가 아닙니다.</div>
  </div>;
}
