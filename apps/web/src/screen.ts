// Binary display log documented by BruceDevices/firmware embedded_resources/web_interface/index.js.
// Adapted under AGPL-3.0-only, a59213f3ec6cd302fa32c2042b2700c9c24d991a.
import {readFile} from './connection';
const keys:Record<number,string[]>={0:['fg'],1:['x','y','w','h','fg'],2:['x','y','w','h','fg'],3:['x','y','w','h','r','fg'],4:['x','y','w','h','r','fg'],5:['x','y','r','fg'],6:['x','y','r','fg'],7:['x','y','x2','y2','x3','y3','fg'],8:['x','y','x2','y2','x3','y3','fg'],9:['x','y','rx','ry','fg'],10:['x','y','rx','ry','fg'],11:['x','y','x1','y1','fg'],12:['x','y','r','ir','startAngle','endAngle','fg','bg'],13:['x','y','bx','by','wd','fg','bg'],14:['x','y','size','fg','bg','txt'],15:['x','y','size','fg','bg','txt'],16:['x','y','size','fg','bg','txt'],17:['x','y','size','fg','bg','txt'],18:['x','y','center','ms','fs','file'],19:['x','y','fg'],20:['x','y','h','fg'],21:['x','y','w','fg'],99:['w','h','rotation']};
export type Draw={fn:number;n:Record<string,number>;text:string};
export function decodeScreen(data:Uint8Array):Draw[]{
 const out:Draw[]=[];for(let o=0;o<data.length;){if(data[o]!==0xaa||o+3>data.length)throw new Error('Bildschirmheader ungültig');const len=data[o+1],fn=data[o+2],end=o+len;if(len<3||end>data.length)throw new Error('Bildschirmdaten unvollständig');const fields=keys[fn];if(!fields){o=end;continue;}let p=o+3,text='';const n:Record<string,number>={};for(const key of fields){if(key==='txt'||key==='file'){text=new TextDecoder().decode(data.subarray(p,end));p=end;}else{const bytes=key==='fs'||key==='rotation'?1:2;if(p+bytes>end)throw new Error('Bildschirmfeld unvollständig');let v=bytes===1?data[p]:data[p]*256+data[p+1];if(/^[xyb]/.test(key)&&v>32767)v-=65536;n[key]=v;p+=bytes;}}out.push({fn,n,text});o=end;}return out;
}
const color=(v:number)=>`rgb(${((v>>11)&31)*255/31},${((v>>5)&63)*255/63},${(v&31)*255/31})`;
export async function renderScreen(canvas:HTMLCanvasElement,data:Uint8Array){
 const calls=decodeScreen(data),ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,canvas.width,canvas.height);
 for(const {fn,n,text} of calls){const {x=0,y=0,w=0,h=0,r=0}=n;ctx.beginPath();ctx.lineWidth=1;ctx.strokeStyle=ctx.fillStyle=color(n.fg||0);
 switch(fn){
 case 99:if(w<1||h<1||w>1024||h>1024)throw new Error('Ungültige Bildschirmgröße');canvas.width=w;canvas.height=h;break;
 case 0:ctx.fillRect(0,0,canvas.width,canvas.height);break;
 case 1:ctx.strokeRect(x,y,w,h);break;case 2:ctx.fillRect(x,y,w,h);break;
 case 3:case 4:ctx.roundRect(x,y,w,h,Math.max(0,Math.min(r,Math.abs(w)/2,Math.abs(h)/2)));if(fn===3)ctx.stroke();else ctx.fill();break;
 case 5:case 6:ctx.arc(x,y,Math.max(0,r),0,2*Math.PI);if(fn===5)ctx.stroke();else ctx.fill();break;
 case 7:case 8:ctx.moveTo(x,y);ctx.lineTo(n.x2,n.y2);ctx.lineTo(n.x3,n.y3);ctx.closePath();if(fn===7)ctx.stroke();else ctx.fill();break;
 case 9:case 10:ctx.ellipse(x,y,Math.max(0,n.rx),Math.max(0,n.ry),0,0,2*Math.PI);if(fn===9)ctx.stroke();else ctx.fill();break;
 case 11:ctx.moveTo(x,y);ctx.lineTo(n.x1,n.y1);ctx.stroke();break;
 case 12:ctx.lineWidth=Math.max(1,r-n.ir);ctx.arc(x,y,Math.max(0,(r+n.ir)/2),(n.startAngle+90)*Math.PI/180,(n.endAngle+90)*Math.PI/180);ctx.stroke();break;
 case 13:ctx.lineWidth=n.wd||1;ctx.moveTo(x,y);ctx.lineTo(n.bx,n.by);ctx.stroke();break;
 case 14:case 15:case 16:case 17:{const size=Math.min(10,Math.max(1,n.size));ctx.font=`${size*8}px monospace`;const width=ctx.measureText(text).width;const offset=fn===14?width/2:fn===15?width:0;ctx.fillStyle=color(n.bg===n.fg?0:n.bg);ctx.fillRect(x-offset,y,width,size*8);ctx.fillStyle=color(n.fg);ctx.textBaseline='top';ctx.textAlign=fn===14?'center':fn===15?'right':'left';ctx.fillText(text,x,y);break;}
 case 18:try{const blob=await readFile(n.fs===0?'SD':'LittleFS',text);const u=URL.createObjectURL(blob);try{const img=new Image();img.src=u;await img.decode();ctx.drawImage(img,x+(n.center?(canvas.width-img.width)/2:0),y+(n.center?(canvas.height-img.height)/2:0));}finally{URL.revokeObjectURL(u);}}catch{ctx.strokeStyle='#edb45a';ctx.strokeRect(x,y,24,24);}break;
 case 19:ctx.fillRect(x,y,1,1);break;case 20:ctx.fillRect(x,y,1,h);break;case 21:ctx.fillRect(x,y,w,1);break;
 }
 }
}
