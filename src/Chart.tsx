import { useEffect, useRef,useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent, GraphicComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { Download } from 'lucide-react';
echarts.use([LineChart,BarChart,PieChart,GridComponent,TooltipComponent,LegendComponent,TitleComponent,GraphicComponent,CanvasRenderer]);
export function Chart({option,title,subtitle,empty,reduceMotion,small=false,demo=false}:{option:object;title:string;subtitle:string;empty?:string;reduceMotion:boolean;small?:boolean;demo?:boolean}) {
  const ref=useRef<HTMLDivElement>(null), chart=useRef<echarts.EChartsType|null>(null);
  const [exportUrl,setExportUrl]=useState('');
  useEffect(()=>{if(!ref.current)return;const c=echarts.init(ref.current,undefined,{renderer:'canvas'});chart.current=c;const resize=new ResizeObserver(()=>c.resize());resize.observe(ref.current);return()=>{resize.disconnect();c.dispose();};},[]);
  useEffect(()=>{chart.current?.setOption({backgroundColor:'#0d1523',color:['#d6bd85','#48d9cc'],animation:!reduceMotion,textStyle:{fontFamily:'Inter, Segoe UI, Malgun Gothic, sans-serif',color:'#7d8b9f'},tooltip:{trigger:'axis',backgroundColor:'#172538',borderColor:'#2b3c53',textStyle:{color:'#dce5ef'}},...option},true);},[option,reduceMotion]);
  useEffect(()=>setExportUrl(''),[option]);
  useEffect(()=>()=>{if(exportUrl)URL.revokeObjectURL(exportUrl);},[exportUrl]);
  const filename=`${demo?'DEMO-':''}robotaxi-atlas-${title}.png`;
  const save=()=>{const c=chart.current;if(!c)return;c.setOption({title:{text:`${demo?'[DEMO] ':''}ROBOTAXI ATLAS · ${title}`,subtext:subtitle,textStyle:{fontSize:12,color:'#e4eaf1'},subtextStyle:{fontSize:10,color:'#a5b4c7'},left:20,top:4},...(empty?{graphic:[{type:'text',left:'center',top:'middle',style:{text:empty,fill:'#a5b4c7',fontSize:12}}]}:{})});const a=document.createElement('a');const dataUrl=c.getDataURL({pixelRatio:2,backgroundColor:'#0d1523'});const bytes=Uint8Array.from(atob(dataUrl.split(',')[1]),x=>x.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));setExportUrl(url);a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();c.setOption({title:{text:'',subtext:''},graphic:[]},{replaceMerge:['graphic']});};
  return <section className={`panel chart-card ${small?'small':''}`}><div className="panel-heading"><div><h3>{title}</h3><p>{subtitle}</p></div><button className="icon-button" onClick={save} title={`${title} PNG 저장`} aria-label={`${title} PNG 저장`}><Download size={15}/></button></div><div className="chart-wrap"><div ref={ref} className="chart" role="img" aria-label={`${title}. ${empty||subtitle}`}/>{empty&&<div className="chart-empty"><span className="empty-line"/><b>{empty}</b><span>근거가 있는 기록부터 그래프에 표시합니다</span></div>}</div>{exportUrl&&<a className="export-link" href={exportUrl} download={filename}>{title} PNG 다시 저장 ↗</a>}</section>;
}
