import {createHash} from 'node:crypto';
export const DISCOVERY_FEEDS=[
 {id:'google-global',name:'Google News · 전 세계 Tesla Robotaxi/Cybercab 검색 RSS',url:'https://news.google.com/rss/search?q=Tesla%20(robotaxi%20OR%20Cybercab)%20when%3A7d&hl=en-US&gl=US&ceid=US%3Aen'},
 {id:'bing-global',name:'Bing News · Tesla Robotaxi 검색 RSS',url:'https://www.bing.com/news/search?q=Tesla+robotaxi&format=rss'},
 {id:'google-korean',name:'Google News · 한국어 해외·국내 소식 탐색 RSS',url:'https://news.google.com/rss/search?q=%ED%85%8C%EC%8A%AC%EB%9D%BC%20%EB%A1%9C%EB%B3%B4%ED%83%9D%EC%8B%9C%20when%3A7d&hl=ko&gl=KR&ceid=KR%3Ako'}
];
export const US_DISCOVERY_FEEDS=[
 {id:'google-us',name:'Google News · 미국 Tesla Robotaxi 검색 RSS',url:'https://news.google.com/rss/search?q=Tesla%20(robotaxi%20OR%20Cybercab)%20(USA%20OR%20%22United%20States%22%20OR%20%22U.S.%22)%20when%3A7d&hl=en-US&gl=US&ceid=US%3Aen'},
 {id:'bing-us',name:'Bing News · 미국 Tesla Robotaxi 검색 RSS',url:'https://www.bing.com/news/search?q=Tesla+robotaxi+(USA+OR+%22United+States%22)&format=rss'}
];
const clean=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
export function parseNewsFeed(xml,feed,now){
 if(!/<rss[\s>]/i.test(xml))throw Error('RSS 형식 변경');
 return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(m=>{
  const field=name=>clean(m[1].match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]??'');
  const title=field('title').slice(0,240);if(!/tesla|테슬라|cybercab|사이버캡/i.test(title)||!/robotaxi|robo.taxi|로보택시|cybercab|사이버캡/i.test(title))return [];
  let url=field('link');try{const u=new URL(url);if(u.hostname.endsWith('bing.com')&&u.searchParams.get('url'))url=u.searchParams.get('url');if(!/^https:\/\//.test(url))return [];}catch{return [];}
  const date=field('pubDate'),publishedAt=Number.isFinite(Date.parse(date))?new Date(date).toISOString():null;
  const id=createHash('sha256').update(url+'|'+title).digest('hex').slice(0,24);
  return [{id,title,url,publisher:field('source')||new URL(url).hostname,publishedAt,firstCollectedAt:now,feedId:feed.id,verification:'discovery_only',note:'검색 피드에서 발견한 원문 검토 후보. 기사 제목만으로 차량 수·허가·상업운행을 확정하지 않음.'}];
 }).slice(0,80);
}
export async function collectDiscovery(prior={items:[],runs:[]},{fetcher=fetch,now=new Date().toISOString(),forceFailure=false,scope='GLOBAL'}={}){
 const next=structuredClone(prior),byId=new Map([...(next.archivedItems??[]),...(next.items??[])].map(i=>[i.id,i]));next.feeds=[];next.scope=scope;let added=0;const feeds=scope==='US'?US_DISCOVERY_FEEDS:DISCOVERY_FEEDS;
 for(const feed of feeds){
  const old=prior.feeds?.find(f=>f.id===feed.id);let state={...feed,checkedAt:now,state:'access_failed',lastSuccessAt:old?.lastSuccessAt??null};
  try{if(forceFailure)throw Error('탐색 실패 모의');const r=await fetcher(feed.url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);const xml=await r.text();if(xml.length>1500000)throw Error('RSS 크기 제한');const items=parseNewsFeed(xml,feed,now);for(const item of items){const oldItem=byId.get(item.id);if(!oldItem){byId.set(item.id,{...item,scopeMatches:{[scope]:now}});added++;}else byId.set(item.id,{...oldItem,scopeMatches:{...oldItem.scopeMatches,[scope]:oldItem.scopeMatches?.[scope]??now}});}state={...state,state:'ok',lastSuccessAt:now,found:items.length,message:'검색 RSS 조회 성공. 원문 검토 후보이며 신규 진출 확인과 구분.'};}catch(e){state.message=e.message+' · 기존 후보와 최초 수집일 보존';}
  next.feeds.push(state);
 }
 const isUS=item=>!!item.scopeMatches?.US||US_DISCOVERY_FEEDS.some(f=>f.id===item.feedId);
 if(scope==='US'){const archived=new Map((prior.archivedItems??[]).map(item=>[item.id,item]));for(const item of prior.items??[])if(!isUS(item)&&!archived.has(item.id))archived.set(item.id,item);next.archivedItems=[...archived.values()];}
 next.items=[...byId.values()].filter(item=>scope!=='US'||isUS(item)).sort((a,b)=>(b.publishedAt??b.firstCollectedAt).localeCompare(a.publishedAt??a.firstCollectedAt)).slice(0,300);
 next.lastRun={checkedAt:now,successfulFeeds:next.feeds.filter(f=>f.state==='ok').length,totalFeeds:feeds.length,newCandidates:added,state:next.feeds.some(f=>f.state==='ok')?'completed_with_review_candidates':'failed',scope,note:scope==='US'?'미국 관련 검색 후보이며 원문 검토 전입니다. 모든 미국 지역의 모든 소식을 포괄하지 않습니다.':'전 세계 검색 피드 탐색과 연결된 공식 자료 변경 감지는 별도 작업. 검색 결과가 모든 국가·언어의 모든 소식을 포괄하지 않음.'};
 return next;
}
