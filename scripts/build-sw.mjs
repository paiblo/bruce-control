import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = "apps/web/dist";
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...(await walk(dir + "/" + e.name)));
    else if (e.name !== "sw.js") out.push(dir + "/" + e.name);
  }
  return out;
}
const files = await walk(root);
const hash = createHash("sha256");
for (const f of files) hash.update(await readFile(f));
const version = "bruce-" + hash.digest("hex").slice(0, 12),
  assets = files.map((f) => "/bruce-control/" + f.slice(root.length + 1));
assets.push("/bruce-control/");
await writeFile(
  root + "/sw.js",
  `const CACHE=${JSON.stringify(version)},ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bruce-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith('/bruce-control/')||url.search)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/bruce-control/index.html')));return;}if(ASSETS.includes(url.pathname))e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));});
`,
);
console.log("Offline shell:", assets.length, "assets,", version);
