import {openDB} from 'idb';
export type Item={id:string;name:string;category:string;content:string;favorite:boolean;updated:number};
const db=()=>openDB('bruce-control',1,{upgrade(db){db.createObjectStore('library',{keyPath:'id'});db.createObjectStore('settings');}});
export async function items(){return (await (await db()).getAll('library')) as Item[];}
export async function saveItem(i:Item){await (await db()).put('library',i);}
export async function removeItem(id:string){await (await db()).delete('library',id);}
export async function setting<T>(key:string,value?:T):Promise<T|undefined>{const d=await db();if(value!==undefined)await d.put('settings',value,key);return d.get('settings',key);}
export async function clearPair(){await (await db()).delete('settings','pair');}
