import Papa from 'papaparse';
export type Point={lat:number;lon:number;accuracy:number|null;timestamp:number;speed?:number|null;heading?:number|null;segment?:number};
export function distance(a:Point,b:Point){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;const h=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
export function validPoint(p:Point,previous?:Point,now=Date.now()){
 if(![p.lat,p.lon,p.timestamp].every(Number.isFinite)||(p.accuracy!==null&&!Number.isFinite(p.accuracy))||Math.abs(p.lat)>90||Math.abs(p.lon)>180||(p.accuracy!==null&&(p.accuracy<0||p.accuracy>100))||Math.abs(now-p.timestamp)>15000)return false;
 if(previous){const dt=(p.timestamp-previous.timestamp)/1000;if(dt<=0)return false;if(distance(previous,p)/dt>80)return false;if(distance(previous,p)<Math.max(2,Math.min(p.accuracy??0,previous.accuracy??0)*0.3))return false;}return true;
}
export function trackDistance(points:Point[]){return points.reduce((n,p,i)=>i&&p.segment===points[i-1].segment?n+distance(points[i-1],p):n,0);}
export function duration(points:Point[]){return points.reduce((n,p,i)=>i&&p.segment===points[i-1].segment?n+Math.max(0,p.timestamp-points[i-1].timestamp):n,0);}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function exportTrack(points:Point[],name:string,format:'gpx'|'csv'|'geojson'){
 if(format==='csv')return Papa.unparse(points);
 const segments:Point[][]=[];for(const p of points){if(!segments.length||segments.at(-1)!.at(-1)!.segment!==p.segment)segments.push([]);segments.at(-1)!.push(p);}
 if(format==='geojson')return JSON.stringify({type:'Feature',properties:{name},geometry:{type:'MultiLineString',coordinates:segments.map(s=>s.map(p=>[p.lon,p.lat]))},brucePoints:points},null,2);
 return '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Bruce Control" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>'+esc(name)+'</name>'+segments.map(s=>'<trkseg>'+s.map(p=>`<trkpt lat="${p.lat}" lon="${p.lon}"><time>${new Date(p.timestamp).toISOString()}</time></trkpt>`).join('')+'</trkseg>').join('')+'</trk></gpx>';
}
export function importTrack(text:string,filename:string):Point[]{
 let out:Point[]=[];
 if(filename.endsWith('.gpx')){const xml=new DOMParser().parseFromString(text,'application/xml');if(xml.querySelector('parsererror'))throw new Error('Ungültiges GPX');xml.querySelectorAll('trkseg').forEach((s,segment)=>s.querySelectorAll('trkpt').forEach(e=>out.push({lat:Number(e.getAttribute('lat')),lon:Number(e.getAttribute('lon')),timestamp:Date.parse(e.querySelector('time')?.textContent||'')||Date.now(),accuracy:0,segment})));}
 else if(filename.endsWith('.geojson')||filename.endsWith('.json')){const d=JSON.parse(text);if(Array.isArray(d.brucePoints))out=d.brucePoints;else{const g=d.geometry||d;const groups=g.type==='MultiLineString'?g.coordinates:[g.coordinates];out=groups.flatMap((s:number[][],segment:number)=>s.map(([lon,lat],i)=>({lat,lon,accuracy:0,timestamp:Date.now()+i*1000,segment})));}}
 else{const parsed=Papa.parse<Record<string,string>>(text,{header:true,skipEmptyLines:true});if(parsed.errors.length)throw new Error('CSV konnte nicht gelesen werden');out=parsed.data.map(p=>({lat:Number(p.lat),lon:Number(p.lon),accuracy:Number(p.accuracy)||0,timestamp:Number(p.timestamp)||Date.parse(p.time)||Date.now(),segment:Number(p.segment)||0}));}
 if(!out.length||out.length>100000||out.some(p=>![p.lat,p.lon,p.timestamp].every(Number.isFinite)||Math.abs(p.lat)>90||Math.abs(p.lon)>180))throw new Error('Keine gültigen Koordinaten');return out;
}
export type Network={mac:string;ssid:string;auth:string;lat:number;lon:number;rssi:number;time:string};
export function importWardriving(text:string):Network[]{
 const lines=text.split(/\r?\n/),i=lines.findIndex(l=>/^MAC,SSID,AuthMode,/i.test(l));if(i<0)throw new Error('WiGLE/Bruce-CSV-Kopf fehlt');
 const p=Papa.parse<Record<string,string>>(lines.slice(i).join('\n'),{header:true,skipEmptyLines:true});
 return p.data.map(r=>({mac:r.MAC,ssid:r.SSID,auth:r.AuthMode,lat:Number(r.CurrentLatitude),lon:Number(r.CurrentLongitude),rssi:Number(r.RSSI),time:r.FirstSeen})).filter(r=>r.mac&&Number.isFinite(r.lat)&&Number.isFinite(r.lon)&&Math.abs(r.lat)<=90&&Math.abs(r.lon)<=180);
}
export function download(name:string,content:BlobPart,type?:string){const mime=type|| (name.endsWith('.gpx')?'application/gpx+xml':name.endsWith('.csv')?'text/csv':name.endsWith('.json')||name.endsWith('.geojson')?'application/json':'application/octet-stream');const u=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=u;a.download=name;a.rel='noopener';a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(u);},30000);}
