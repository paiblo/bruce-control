import type {ButtonHTMLAttributes,ReactNode} from 'react';
import {Info} from 'lucide-react';
export function Button({children,quiet=false,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{quiet?:boolean}){return <button {...props} className={'button '+(quiet?'quiet ':'')+(props.className||'')}>{children}</button>;}
export function Card({children,className=''}:{children:ReactNode;className?:string}){return <section className={'card '+className}>{children}</section>;}
export function Notice({children}:{children:ReactNode}){return <div className="notice"><Info size={16}/><span>{children}</span></div>;}
export function Section({eyebrow,title,right}:{eyebrow:string;title:string;right?:ReactNode}){return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div>{right}</div>;}
export function Stat({label,value,unit}:{label:string;value:ReactNode;unit?:string}){return <div className="stat"><small>{label}</small><strong>{value}<em>{unit}</em></strong></div>;}
export function Ring({free,total,label}:{free?:number;total?:number;label:string}){const percent=total&&free!==undefined?(total-free)/total*100:undefined;return <div className="ring-stat"><div className="ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="33"/><circle cx="40" cy="40" r="33" strokeDasharray={`${(percent||0)*2.073} 207.3`}/></svg><b>{percent!==undefined?Math.round(percent)+'%':'—'}</b></div><span>{label}<small>{free!==undefined?(free/1048576).toFixed(1)+' MB frei':'Keine Gerätedaten'}</small></span></div>;}
