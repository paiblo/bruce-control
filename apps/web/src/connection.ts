import {
  commandSchema,
  type DeviceInfo,
  type Method,
  type Reply,
} from "../../../packages/protocol/src";
import { setting, clearPair } from "./db";
export const DEFAULT_RELAY =
  import.meta.env.VITE_RELAY_URL ||
  "https://bruce-control-relay.paiblo-besser.workers.dev";
export type Pair = { relay: string; device: string; token: string };
export class Connection extends EventTarget {
  status = "offline";
  deviceOnline = false;
  info?: DeviceInfo;
  lastConnected?: number;
  socket?: WebSocket;
  nonce = "";
  seq = 0;
  pair?: Pair;
  retries = 0;
  stopped = true;
  timer?: ReturnType<typeof setTimeout>;
  heartbeat?: ReturnType<typeof setInterval>;
  pong = 0;
  pending = new Map<
    string,
    {
      resolve: (data: Record<string, unknown>) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
      acked: boolean;
    }
  >();
  emit() {
    this.dispatchEvent(new Event("change"));
  }
  async restore() {
    const p = await setting<Pair>("pair");
    if (p) this.connect(p);
  }
  connect(p: Pair) {
    this.disconnect();
    this.pair = p;
    this.stopped = false;
    this.open();
  }
  open() {
    if (this.stopped || !this.pair) return;
    this.status = "connecting";
    this.emit();
    const { relay, device, token } = this.pair;
    let url: URL;
    try {
      url = new URL(relay);
      if (
        url.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(url.hostname)
      )
        throw new Error("HTTPS erforderlich");
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = `/v1/devices/${device}/ws`;
      url.search = "";
      url.hash = "";
    } catch {
      this.status = "error";
      this.emit();
      return;
    }
    const ws = new WebSocket(url);
    this.socket = ws;
    ws.binaryType = "arraybuffer";
    const authTimeout = setTimeout(() => ws.close(), 10000);
    ws.onopen = () =>
      ws.send(JSON.stringify({ v: 1, type: "auth", role: "browser", token }));
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        this.dispatchEvent(new CustomEvent("screen", { detail: e.data }));
        return;
      }
      if (e.data === "pong") {
        this.pong = Date.now();
        return;
      }
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.type === "ready") {
        clearTimeout(authTimeout);
        this.nonce = m.nonce;
        this.seq = 0;
        this.retries = 0;
        this.status = "connected";
        this.deviceOnline = m.deviceOnline;
        this.lastConnected = Date.now();
        this.pong = Date.now();
        this.heartbeat = setInterval(() => {
          if (Date.now() - this.pong > 60000) {
            ws.close();
            return;
          }
          if (ws.readyState === 1) ws.send("ping");
        }, 25000);
        this.emit();
        if (this.deviceOnline) void this.refresh();
      }
      if (m.type === "presence") {
        this.deviceOnline = !!m.online;
        if (!this.deviceOnline) {
          this.info = undefined;
          this.rejectAll();
        }
        this.emit();
        if (this.deviceOnline) void this.refresh();
      }
      if (m.type === "ack") {
        const p = this.pending.get(m.id);
        if (p) p.acked = true;
      }
      if (m.type === "result") {
        const r = m as Reply,
          p = this.pending.get(r.id);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(r.id);
          if (r.ok) p.resolve(r.data || {});
          else p.reject(new Error(r.error || "Gerätefehler"));
        }
      }
    };
    ws.onclose = (e) => {
      clearTimeout(authTimeout);
      clearInterval(this.heartbeat);
      if (ws !== this.socket) return;
      this.deviceOnline = false;
      this.info = undefined;
      this.rejectAll();
      if (e.code === 4003) {
        this.status = "unauthorized";
        this.stopped = true;
        void clearPair();
      } else if (e.code === 4002) {
        this.status = "replaced";
        this.stopped = true;
      } else {
        this.status = this.stopped ? "offline" : "reconnecting";
        if (!this.stopped)
          this.timer = setTimeout(
            () => this.open(),
            Math.min(30000, 1000 * 2 ** this.retries++) *
              (0.8 + Math.random() * 0.4),
          );
      }
      this.emit();
    };
    ws.onerror = () => {
      this.status = "error";
      this.emit();
    };
  }
  rejectAll() {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(
        new Error(
          p.acked
            ? "Verbindung unterbrochen; Ausführung möglicherweise erfolgt."
            : "Verbindung unterbrochen.",
        ),
      );
    }
    this.pending.clear();
  }
  disconnect() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.heartbeat);
    this.socket?.close();
    this.socket = undefined;
    this.deviceOnline = false;
    this.info = undefined;
    this.rejectAll();
    this.status = "offline";
    this.emit();
  }
  can(m: Method) {
    return this.deviceOnline && !!this.info?.capabilities.includes(m);
  }
  command(
    method: Method,
    params: unknown = {},
  ): Promise<Record<string, unknown>> {
    if (this.socket?.readyState !== 1 || !this.deviceOnline)
      return Promise.reject(new Error("Kein Gerät verbunden."));
    if (method !== "device.info" && !this.can(method))
      return Promise.reject(
        new Error("Firmware unterstützt diese Funktion nicht."),
      );
    const c = {
      v: 1,
      type: "command",
      id: crypto.randomUUID(),
      nonce: this.nonce,
      seq: ++this.seq,
      ts: Date.now(),
      method,
      params,
    };
    if (!commandSchema.safeParse(c).success)
      return Promise.reject(new Error("Ungültiger Befehl oder Parameter."));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(c.id);
        reject(
          new Error(
            "Zeitüberschreitung; Ausführung möglicherweise erfolgt. Nicht automatisch wiederholt.",
          ),
        );
      }, 16000);
      this.pending.set(c.id, { resolve, reject, timer, acked: false });
      this.socket!.send(JSON.stringify(c));
    });
  }
  async refresh() {
    try {
      this.info = (await this.command("device.info")) as unknown as DeviceInfo;
      this.emit();
    } catch {
      this.info = undefined;
      this.emit();
    }
  }
}
export const connection = new Connection();
export async function api(
  relay: string,
  device: string,
  action: string,
  body: unknown,
) {
  const u = new URL(relay);
  if (
    u.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(u.hostname)
  )
    throw new Error("Relay benötigt HTTPS");
  const r = await fetch(new URL(`/v1/devices/${device}/${action}`, u), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Relay-Fehler");
  return j;
}
export async function readFile(
  drive: string,
  path: string,
  onProgress?: (n: number) => void,
) {
  let offset = 0;
  const parts: BlobPart[] = [];
  while (true) {
    const r = await connection.command("fs.read", {
      drive,
      path,
      offset,
      length: 3072,
    });
    const binary = atob(String(r.data));
    const b = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    parts.push(b);
    offset += b.length;
    onProgress?.((offset / Number(r.total)) * 100);
    if (r.eof) break;
    if (!b.length || offset > 16777216)
      throw new Error("Datei zu groß oder ungültige Antwort");
  }
  return new Blob(parts);
}
export async function writeFile(
  drive: string,
  path: string,
  file: Blob,
  onProgress?: (n: number) => void,
) {
  if (file.size > 1048576) throw new Error("Upload maximal 1 MiB");
  for (let offset = 0; offset < file.size || offset === 0; offset += 3072) {
    const b = new Uint8Array(
      await file.slice(offset, offset + 3072).arrayBuffer(),
    );
    const data = btoa(Array.from(b, (n) => String.fromCharCode(n)).join(""));
    await connection.command("fs.write", {
      drive,
      path,
      offset,
      data,
      final: offset + b.length >= file.size,
    });
    onProgress?.(Math.min(100, ((offset + b.length) / file.size) * 100));
    if (!file.size) break;
  }
}
