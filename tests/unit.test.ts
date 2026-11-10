import {describe,it,expect,vi,afterEach} from 'vitest';
import 'fake-indexeddb/auto';
import {commandSchema,randomHex,hash,timingEqual,pathSchema,positionSchema,Budget,fresh} from '../packages/protocol/src';
import {distance,validPoint,exportTrack,importTrack,importWardriving,trackDistance,duration,type Point} from '../apps/web/src/gps';
import {items,saveItem,removeItem,setting,clearPair} from '../apps/web/src/db';
import {Connection} from '../apps/web/src/connection';
const point:Point={lat:52,lon:13,accuracy:5,timestamp:1700000000000,segment:0};
const command={v:1,type:'command',id:crypto.randomUUID(),nonce:crypto.randomUUID(),seq:1,ts:Date.now(),method:'device.info',params:{}};
afterEach(()=>vi.useRealTimers());
describe('Protocol',()=>{
 it('accepts known typed command and rejects unknown versions and methods',()=>{expect(commandSchema.safeParse(command).success).toBe(true);expect(commandSchema.safeParse({...command,v:2}).success).toBe(false);expect(commandSchema.safeParse({...command,method:'deauth'}).success).toBe(false);});
 it('limits input pulses and prevents arbitrary terminal execution',()=>{expect(commandSchema.safeParse({...command,method:'input.press',params:{key:'sel',duration:10000}}).success).toBe(false);expect(commandSchema.safeParse({...command,method:'terminal.run',params:{command:'info; reboot'}}).success).toBe(false);});
 it('protects credentials, traversal, absolute drive paths and write scope',()=>{for(const p of ['/../etc','/bruce.conf','/BRUCE.CONF','/bridge.json','/a\\b'])expect(pathSchema.safeParse(p).success).toBe(false);expect(commandSchema.safeParse({...command,method:'fs.delete',params:{drive:'SD',path:'/important.ir'}}).success).toBe(false);});
 it('checks token entropy and digest comparison',async()=>{const a=randomHex();expect(a).toHaveLength(64);expect(a).not.toBe(randomHex());expect(timingEqual(await hash(a),await hash(a))).toBe(true);expect(timingEqual('aa','ab')).toBe(false);});
 it('rejects stale timestamps, invalid coordinates and exhausted rate budget',()=>{expect(fresh(Date.now()-60000)).toBe(false);expect(positionSchema.safeParse({...point,lat:91,source:'phone'}).success).toBe(false);const b=new Budget(2,1,0);expect([b.take(0),b.take(0),b.take(0)]).toEqual([true,true,false]);expect(b.take(1000)).toBe(true);});
});
describe('GPS',()=>{
 it('measures distance and rejects poor accuracy, stale data, duplicates and jumps',()=>{expect(distance(point,{...point,lat:52.001})).toBeCloseTo(111.195,1);expect(validPoint({...point,timestamp:Date.now(),accuracy:200})).toBe(false);expect(validPoint(point)).toBe(false);expect(validPoint({...point,lat:53,timestamp:point.timestamp+1000},point,point.timestamp+1000)).toBe(false);expect(validPoint({...point,timestamp:point.timestamp+1000},point,point.timestamp+1000)).toBe(false);});
 it('does not connect paused recording segments',()=>{const a=[point,{...point,lat:52.001,timestamp:point.timestamp+10000},{...point,lat:53,segment:1,timestamp:point.timestamp+50000}];expect(trackDistance(a)).toBeCloseTo(111.195,1);expect(duration(a)).toBe(10000);expect(exportTrack(a,'A & B','gpx')).toContain('A &amp; B');expect(exportTrack(a,'x','gpx').match(/<trkseg>/g)).toHaveLength(2);});
 it('round-trips CSV and GeoJSON tracks',()=>{const p=[point,{...point,lat:52.01}];expect(importTrack(exportTrack(p,'Test','csv'),'a.csv')).toEqual(p);expect(importTrack(exportTrack(p,'Test','geojson'),'a.geojson')).toEqual(p);expect(()=>importTrack('lat,lon\n99,300','a.csv')).toThrow();});
 it('parses quoted WiGLE SSIDs without inventing missing locations',()=>{const w='WigleWifi-1.4\nMAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,AltitudeMeters,AccuracyMeters,Type\naa:bb,"Test, WLAN",[WPA2],2026-01-01,6,-62,52.1,13.2,0,5,WIFI\n';const n=importWardriving(w);expect(n).toHaveLength(1);expect(n[0].ssid).toBe('Test, WLAN');expect(n[0].rssi).toBe(-62);});
});
describe('IndexedDB',()=>{
 it('persists, edits and removes local library records and credentials separately',async()=>{const i={id:'test',name:'IR',content:'test',category:'IR',favorite:false,updated:1};await saveItem(i);expect((await items()).find(x=>x.id==='test')).toEqual(i);await saveItem({...i,favorite:true});expect((await items())[0].favorite).toBe(true);await setting('pair',{token:'secret'});await clearPair();expect(await setting('pair')).toBeUndefined();expect(await items()).toHaveLength(1);await removeItem('test');expect(await items()).toHaveLength(0);});
});
describe('Client failures',()=>{
 it('refuses device commands while offline',async()=>{await expect(new Connection().command('device.info')).rejects.toThrow('Kein Gerät');});
 it('times out exactly once and never resends an uncertain input',async()=>{vi.useFakeTimers();const c=new Connection();const send=vi.fn();c.socket={readyState:1,send} as unknown as WebSocket;c.deviceOnline=true;c.nonce=crypto.randomUUID();c.info={capabilities:['input.press']} as typeof c.info;const p=c.command('input.press',{key:'sel',duration:10});const rejected=expect(p).rejects.toThrow('Ausführung möglicherweise');await vi.advanceTimersByTimeAsync(16001);await rejected;expect(send).toHaveBeenCalledTimes(1);expect(c.pending.size).toBe(0);});
});
