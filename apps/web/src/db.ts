import {openDB} from 'idb';
export type Item={id:string;name:string;category:string;content:string;favorite:boolean;updated:number};
const db=()=>openDB('bruce-control',1,{upgrade(db){db.createObjectStore('library',{keyPath:'id'});db.createObjectStore('settings');}});
export async function items(){return (await (await db()).getAll('library')) as Item[];}
export async function saveItem(i:Item){await (await db()).put('library',i);}
export async function removeItem(id:string){await (await db()).delete('library',id);}
export async function setting<T>(key:string,value?:T):Promise<T|undefined>{const d=await db();if(value!==undefined)await d.put('settings',value,key);return d.get('settings',key);}
export async function clearPair(){await (await db()).delete('settings','pair');}
export async function restoreBackup(text:string){const parsed:unknown=JSON.parse(text);if(!Array.isArray(parsed)||parsed.length>5000)throw new Error('Ungültiges Bibliotheksbackup');const list:Item[]=[];for(const value of parsed){if(typeof value!=='object'||value===null)throw new Error('Ungültiger Eintrag');const r=value as Record<string,unknown>;if(typeof r.id!=='string'||typeof r.name!=='string'||typeof r.category!=='string'||typeof r.content!=='string'||typeof r.favorite!=='boolean'||typeof r.updated!=='number'||r.content.length>10000000)throw new Error('Ungültiger Bibliothekseintrag');list.push({id:r.id,name:r.name,category:r.category,content:r.content,favorite:r.favorite,updated:r.updated});}const d=await db(),tx=d.transaction('library','readwrite');for(const i of list)await tx.store.put(i);await tx.done;return list.length;}
