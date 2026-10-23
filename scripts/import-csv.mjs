import { readFile,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export function parseCSV(text){
  const rows=[];let row=[],cell='',quoted=false;
  text=text.replace(/^\ufeff/,'');
  for(let i=0;i<=text.length;i++){const c=text[i]??'\n';if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw Error('닫히지 않은 CSV 인용부호');
  const [headers,...records]=rows;if(!headers)return [];
  return records.map(values=>{const o=Object.fromEntries(headers.map((h,i)=>[h.trim(),values[i]??'']));return {...o,count:o.count.trim()===''?NaN:Number(o.count),asOf:o.asOf||null,locked:o.locked==='true',independentGroups:o.independentGroups?o.independentGroups.split('|'):undefined};});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const file=process.argv[2]??'data/manual.csv';const records=parseCSV(await readFile(file,'utf8'));await writeFile('data/manual.json',JSON.stringify(records,null,2)+'\n');console.log(`${records.length}개 수동 행 변환. collect 실행 때 검증합니다.`);}
