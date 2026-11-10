// Bruce Control bridge, AGPL-3.0-only. Runs CLI work on Bruce's existing serial task.
#include "control_bridge.h"
#include "bridge_ca.h"
#include <globals.h>
#include "core/display.h"
#include "core/mykeyboard.h"
#include "core/utils.h"
#include "core/serial_commands/cli.h"
#include "core/settings.h"
#include "core/sd_functions.h"
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WiFi.h>
#include <NetworkClientSecure.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <mbedtls/base64.h>
#include <time.h>
#ifndef BRIDGE_HOST
#define BRIDGE_HOST "bruce-control-relay.paiblo-besser.workers.dev"
#endif
namespace {
Preferences prefs;
WebSocketsClient socket;
QueueHandle_t incoming=nullptr,outgoing=nullptr;
SemaphoreHandle_t shared=nullptr;
char id[33]={0},token[65]={0},code[9]={0},claim[40]={0};
volatile bool online=false,pairing=false;
String host;
uint32_t lastPong=0;
struct Out {String *text; uint8_t *binary; size_t size;};
struct Fix {double lat=0,lon=0,accuracy=0,hdop=0;int satellites=-1;uint32_t at=0;double timestamp=0;} phone,gnss;
String seen[64];uint8_t seenIndex=0;
String hexRandom(size_t n){String r;for(size_t i=0;i<n;i++){char b[3];snprintf(b,3,"%02x",(unsigned)esp_random()&255);r+=b;}return r;}
void enqueue(const String &s){Out out{new String(s),nullptr,0};if(xQueueSend(outgoing,&out,0)!=pdTRUE)delete out.text;}
void sendJson(JsonDocument &d){String s;serializeJson(d,s);enqueue(s);}
void event(const char *type){JsonDocument d;d["v"]=1;d["type"]=type;sendJson(d);}
class Capture:public SerialDevice {
public:String text;
 size_t print(const String &s)override{size_t n=min((size_t)s.length(),(size_t)24000-text.length());text+=s.substring(0,n);return n;}
 size_t println(const String &s)override{return print(s+"\n");}
 size_t println(size_t n)override{return println(String(n));}
 size_t println(uint32_t n)override{return println(String(n));}
 size_t println()override{return print("\n");}
 size_t println(int n,int f=DEC)override{return println(String(n,f));}
 size_t print(int n,int f=DEC)override{return print(String(n,f));}
 void vprintf(const char *fmt,va_list a)override{char b[512];vsnprintf(b,sizeof(b),fmt,a);print(String(b));}
 int read()override{return -1;}int available()override{return 0;}
 String readStringUntil(char)override{return "";}void flush()override{}
 size_t write(uint8_t *s,size_t n)override{size_t count=min(n,(size_t)24000-text.length());for(size_t i=0;i<count;i++)text+=(char)s[i];return count;}
};
bool safePath(const String &p,bool write=false){String lower=p;lower.toLowerCase();return p.startsWith("/")&&p.length()<181&&p.indexOf("..")<0&&p.indexOf('"')<0&&p.indexOf('\\')<0&&p.indexOf('\n')<0&&lower.indexOf("bruce.conf")<0&&lower.indexOf("bridge.json")<0&&lower.indexOf(".bridge-")<0&&(!write||p.startsWith("/BruceControl/"));}
void info(JsonObject d){
 d["board"]=DEVICE_NAME;d["firmware"]=BRUCE_VERSION;d["bridge"]="0.1.0";
 const char* caps[]={"device.info","screen.get","input.press","terminal.run","fs.list","fs.read","fs.write","fs.mkdir","fs.rename","fs.delete","gps.push","display.brightness","ir.receive","ir.send"};
 JsonArray c=d["capabilities"].to<JsonArray>();for(auto cap:caps)c.add(cap);
 d["uptime"]=millis()/1000;d["heapFree"]=ESP.getFreeHeap();d["heapTotal"]=ESP.getHeapSize();d["psramFree"]=ESP.getFreePsram();d["psramTotal"]=ESP.getPsramSize();
 d["ip"]=WiFi.localIP().toString();d["ssid"]=WiFi.SSID();d["rssi"]=WiFi.RSSI();d["sd"]=SD.cardType()!=CARD_NONE;
 if(SD.cardType()!=CARD_NONE){d["sdTotal"]=SD.totalBytes();d["sdUsed"]=SD.usedBytes();}
 d["fsTotal"]=LittleFS.totalBytes();d["fsUsed"]=LittleFS.usedBytes();
 xSemaphoreTake(shared,portMAX_DELAY);Fix g=gnss;xSemaphoreGive(shared);
 if(g.at&&millis()-g.at<15000){auto gps=d["gps"].to<JsonObject>();gps["lat"]=g.lat;gps["lon"]=g.lon;gps["timestamp"]=g.timestamp;if(g.satellites>=0)gps["satellites"]=g.satellites;if(g.hdop>0)gps["hdop"]=g.hdop;}
}
void execute(JsonDocument &c){
 JsonDocument r;r["v"]=1;r["type"]="result";r["id"]=c["id"];r["ok"]=false;
 auto err=[&](const char *s){r["error"]=s;sendJson(r);};
 String cid=c["id"]|"";double ts=c["ts"]|0.0;double now=(double)time(nullptr)*1000;
 if(c["v"]!=1||cid.length()!=36||fabs(now-ts)>30000){err("Befehl abgelaufen oder ungültig");return;}
 for(const auto &s:seen)if(s==cid){err("Befehl bereits verarbeitet");return;}seen[seenIndex++%64]=cid;
 String method=c["method"]|"";JsonObject p=c["params"].as<JsonObject>();auto data=r["data"].to<JsonObject>();
 if(pairing){err("Kopplung am Gerät aktiv");return;}
 if(method=="device.info")info(data);
 else if(method=="screen.get"){
  auto b=(uint8_t*)ps_malloc(MAX_LOG_SIZE*MAX_LOG_ENTRIES+32);if(!b){err("Kein Bildspeicher");return;}size_t n=0;tft.getBinLog(b,n);
  Out o{nullptr,b,n};if(xQueueSend(outgoing,&o,0)!=pdTRUE){free(b);err("Sendewarteschlange voll");return;}data["bytes"]=n;
 }else if(method=="input.press"){
  String key=p["key"]|"";int duration=p["duration"]|10;if(duration<10||duration>1000){err("Ungültige Dauer");return;}
  volatile bool *v=nullptr;if(key=="up")v=&UpPress;if(key=="down")v=&DownPress;if(key=="prev")v=&PrevPress;if(key=="next")v=&NextPress;if(key=="sel")v=&SelPress;if(key=="esc")v=&EscPress;
  if(!v){err("Ungültige Taste");return;}uint32_t end=millis()+duration;do{AnyKeyPress=true;SerialCmdPress=true;*v=true;vTaskDelay(pdMS_TO_TICKS(10));}while((int32_t)(end-millis())>0);data["accepted"]=true;
 }else if(method=="terminal.run"||method=="ir.receive"||method=="ir.send"){
  String cmd=p["command"]|"";
  if(method=="terminal.run"&&cmd!="info"&&cmd!="free"&&cmd!="uptime"&&cmd!="date"&&cmd!="storage free"&&cmd!="rfid info"&&cmd!="i2c"){err("Befehl nicht freigegeben");return;}
  if(method=="ir.receive"){int timeout=p["timeout"]|5;if(timeout<1||timeout>10){err("Ungültiger Timeout");return;}cmd=String("ir rx")+(p["raw"].as<bool>()?" --raw":"");}
  if(method=="ir.send"){String path=p["path"]|"";if(!safePath(path,true)||!path.endsWith(".ir")||!p["authorized"].as<bool>()){err("Ungültige IR-Datei");return;}cmd="ir tx_from_file \""+path+"\"";}
  Capture capture;SerialDevice *previous=serialDevice;serialDevice=&capture;bool ok=serialCli.parse(cmd);serialDevice=previous;data["output"]=capture.text;data["success"]=ok;
 }else if(method=="display.brightness"){
  int value=p["value"]|0;if(value<1||value>100){err("Helligkeit 1–100");return;}setBrightness(value,false);data["value"]=value;
 }else if(method=="gps.push"){
  double lat=p["lat"]|999.0,lon=p["lon"]|999.0,accuracy=p["accuracy"]|999.0,t=p["timestamp"]|0.0;
  if(!isfinite(lat)||!isfinite(lon)||lat< -90||lat>90||lon< -180||lon>180||accuracy<0||accuracy>100||fabs(now-t)>15000||p["source"]!="phone"){err("Position ungültig oder veraltet");return;}
  xSemaphoreTake(shared,portMAX_DELAY);phone.lat=lat;phone.lon=lon;phone.accuracy=accuracy;phone.timestamp=t;phone.at=millis();xSemaphoreGive(shared);data["source"]="phone";data["stored"]=true;
 }else if(method.startsWith("fs.")){
  String drive=p["drive"]|"",path=p["path"]|"";
  if(drive!="SD"&&drive!="LittleFS"){err("Ungültiges Dateisystem");return;}if(drive=="SD"&&SD.cardType()==CARD_NONE){err("SD nicht eingehängt; am Gerät öffnen");return;}
  FS &fs=drive=="SD"?(FS&)SD:(FS&)LittleFS;bool writing=method!="fs.list"&&method!="fs.read";
  if(!safePath(path,writing)){err("Pfad geschützt");return;}
  if(method=="fs.list"){
   File dir=fs.open(path);if(!dir||!dir.isDirectory()){err("Verzeichnis nicht gefunden");return;}auto entries=data["entries"].to<JsonArray>();int count=0;
   File f=dir.openNextFile();while(f&&count<200){String fp=f.path();if(safePath(fp)){auto e=entries.add<JsonObject>();e["name"]=f.name();e["path"]=fp;e["directory"]=f.isDirectory();e["size"]=f.size();count++;}f.close();f=dir.openNextFile();}data["truncated"]=count==200;dir.close();
  }else if(method=="fs.read"){
   int len=p["length"]|3072;uint32_t offset=p["offset"]|0;if(len<1||len>3072){err("Block zu groß");return;}File f=fs.open(path);if(!f||f.isDirectory()||offset>f.size()){err("Datei nicht lesbar");return;}f.seek(offset);uint8_t b[3072];int n=f.read(b,len);char out[4097];size_t written=0;mbedtls_base64_encode((uint8_t*)out,sizeof(out),&written,b,n);out[written]=0;data["data"]=out;data["eof"]=f.position()>=f.size();data["total"]=f.size();f.close();
  }else if(method=="fs.write"){
   uint32_t offset=p["offset"]|0;String encoded=p["data"]|"";if(encoded.length()>4096||offset>1048576){err("Upload zu groß");return;}
   String tmp=path+".bridge-upload";if(offset==0){if(fs.exists(path)){err("Zieldatei existiert bereits");return;}fs.mkdir("/BruceControl");fs.remove(tmp);}
   File f=fs.open(tmp,offset==0?FILE_WRITE:FILE_APPEND);if(!f||f.size()!=offset){if(f)f.close();err("Upload-Offset ungültig");return;}
   uint8_t b[3072];size_t n=0;if(mbedtls_base64_decode(b,sizeof(b),&n,(const uint8_t*)encoded.c_str(),encoded.length())!=0){f.close();err("Base64 ungültig");return;}
   size_t count=f.write(b,n);f.flush();f.close();if(count!=n){err("Speicher voll");return;}if(p["final"].as<bool>()&&!fs.rename(tmp,path)){err("Upload-Abschluss fehlgeschlagen");return;}data["written"]=count;
  }else if(method=="fs.mkdir"){if(!fs.mkdir(path)){err("Verzeichnis nicht erstellt");return;}}
  else if(method=="fs.delete"){if(!fs.remove(path)){err("Datei nicht gelöscht; Verzeichnisse bleiben erhalten");return;}}
  else if(method=="fs.rename"){String to=p["target"]|"";if(!safePath(to,true)||fs.exists(to)||!fs.rename(path,to)){err("Umbenennen fehlgeschlagen");return;}}
  else{err("Dateibefehl nicht verfügbar");return;}
 }else{err("Funktion nicht implementiert");return;}
 r["ok"]=true;sendJson(r);
}
void socketEvent(WStype_t type,uint8_t *payload,size_t length){
 if(type==WStype_CONNECTED){JsonDocument d;d["v"]=1;d["type"]="auth";d["role"]="device";d["token"]=token;String s;serializeJson(d,s);socket.sendTXT(s);}
 if(type==WStype_DISCONNECTED)online=false;
 if(type!=WStype_TEXT||length>8192)return;
 if(length==4&&memcmp(payload,"pong",4)==0){lastPong=millis();return;}
 JsonDocument d;if(deserializeJson(d,payload,length))return;String t=d["type"]|"";
 if(t=="ready"){online=true;lastPong=millis();return;}
 if(t=="pair.request"&&pairing){xSemaphoreTake(shared,portMAX_DELAY);strlcpy(claim,d["claim"]|"",sizeof(claim));xSemaphoreGive(shared);return;}
 if(t=="command"&&online){auto s=new String((char*)payload,length);if(xQueueSend(incoming,&s,0)!=pdTRUE){JsonDocument r;r["v"]=1;r["type"]="result";r["id"]=d["id"];r["ok"]=false;r["error"]="Gerät beschäftigt";sendJson(r);delete s;}}
}
void networkTask(void*){
 bool started=false;uint32_t lastPing=0;
 while(true){
  if(WiFi.status()!=WL_CONNECTED){online=false;started=false;socket.disconnect();vTaskDelay(pdMS_TO_TICKS(2000));continue;}
  if(time(nullptr)<1700000000){configTime(0,0,"time.cloudflare.com","pool.ntp.org");vTaskDelay(pdMS_TO_TICKS(1000));continue;}
  if(!started){
   NetworkClientSecure client;client.setCACert(BRIDGE_CA);client.setTimeout(5);HTTPClient http;http.setConnectTimeout(5000);http.setTimeout(5000);
   String url="https://"+host+"/v1/devices/"+id+"/enroll";
   if(!http.begin(client,url)){vTaskDelay(pdMS_TO_TICKS(5000));continue;}
   http.addHeader("Content-Type","application/json");int result=http.POST(String("{\"token\":\"")+token+"\"}");http.end();
   if(result!=200){vTaskDelay(pdMS_TO_TICKS(10000));continue;}
   socket.beginSslWithCA(host.c_str(),443,(String("/v1/devices/")+id+"/ws").c_str(),BRIDGE_CA,"bruce.v1");socket.onEvent(socketEvent);socket.setReconnectInterval(5000);started=true;
  }
  socket.loop();if(online&&millis()-lastPong>70000){socket.disconnect();online=false;}Out o;
  while(xQueueReceive(outgoing,&o,0)==pdTRUE){if(online){if(o.text)socket.sendTXT(*o.text);if(o.binary)socket.sendBIN(o.binary,o.size);}delete o.text;if(o.binary)free(o.binary);}
  if(online&&millis()-lastPing>25000){socket.sendTXT("ping");lastPing=millis();}
  vTaskDelay(pdMS_TO_TICKS(10));
 }
}
}
void controlBridgeStart(){
 shared=xSemaphoreCreateMutex();incoming=xQueueCreate(4,sizeof(String*));outgoing=xQueueCreate(8,sizeof(Out));if(!shared||!incoming||!outgoing)return;
 prefs.begin("bruce-control",false);String i=prefs.getString("id",""),t=prefs.getString("token","");if(i.length()!=32||t.length()!=64){i=hexRandom(16);t=hexRandom(32);prefs.putString("id",i);prefs.putString("token",t);}strlcpy(id,i.c_str(),sizeof(id));strlcpy(token,t.c_str(),sizeof(token));host=prefs.getString("host",BRIDGE_HOST);
 tft.setLogging(true);xTaskCreate(networkTask,"ControlBridge",12288,nullptr,1,nullptr);
}
void controlBridgePoll(){if(!incoming)return;String *s=nullptr;if(xQueueReceive(incoming,&s,0)==pdTRUE){JsonDocument d;if(!deserializeJson(d,*s))execute(d);delete s;}}
void controlBridgeMenu(){
 if(!shared){displayError("Bridge not initialized");return;}
 std::vector<Option> local={
  {"Pair iPhone",[](){
   if(!online){displayError("Relay offline. Connect WiFi.");return;}pairing=true;xSemaphoreTake(shared,portMAX_DELAY);claim[0]=0;snprintf(code,sizeof(code),"%08lu",(unsigned long)(esp_random()%100000000));xSemaphoreGive(shared);
   JsonDocument d;d["v"]=1;d["type"]="pair.open";d["code"]=code;sendJson(d);
   drawMainBorderWithTitle("Control Pairing");padprintln(String("ID: ")+String(id).substring(0,16));padprintln(String(id).substring(16));padprintln(String("Code: ")+code);padprintln("Enter ID + code in PWA.");padprintln("Then press encoder to approve.");uint32_t until=millis()+120000;
   while((int32_t)(until-millis())>0){char current[40];xSemaphoreTake(shared,portMAX_DELAY);strlcpy(current,claim,sizeof(current));xSemaphoreGive(shared);if(current[0]&&check(SelPress)){JsonDocument a;a["v"]=1;a["type"]="pair.approve";a["claim"]=current;sendJson(a);displaySuccess("Pairing approved");break;}if(check(EscPress))break;vTaskDelay(pdMS_TO_TICKS(25));}pairing=false;
  }},
  {"Relay host",[](){String h=keyboard(host,120,"HTTPS relay hostname");if(h.length()>3&&h.indexOf('/')<0&&h.indexOf(':')<0&&h.indexOf(' ')<0){prefs.putString("host",h);displaySuccess("Saved. Reboot device.");}}},
  {"Revoke iPhone",[](){event("pair.revoke");displaySuccess("Revocation requested");}},
  {"Back",[](){}}
 };loopOptions(local,MENU_TYPE_SUBMENU,"Bruce Control");
}
void controlBridgeGNSS(double lat,double lon,int satellites,double hdop){if(!shared)return;xSemaphoreTake(shared,portMAX_DELAY);gnss.lat=lat;gnss.lon=lon;gnss.satellites=satellites;gnss.hdop=hdop;gnss.at=millis();gnss.timestamp=(double)time(nullptr)*1000;xSemaphoreGive(shared);}
bool controlBridgePhone(double &lat,double &lon,double &accuracy){if(!shared)return false;xSemaphoreTake(shared,portMAX_DELAY);Fix p=phone;xSemaphoreGive(shared);if(!p.at||millis()-p.at>15000)return false;lat=p.lat;lon=p.lon;accuracy=p.accuracy;return true;}
