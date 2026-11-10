// Explicit synthetic device test against the deployed relay. No hardware claims.
import { fetch, WebSocket, EnvHttpProxyAgent } from "undici";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const dispatcher = new EnvHttpProxyAgent();
const base = "https://bruce-control-relay.paiblo-besser.workers.dev",
  device = randomBytes(16).toString("hex"),
  token = randomBytes(32).toString("hex");
const post = async (action, body) => {
  const r = await fetch(`${base}/v1/devices/${device}/${action}`, {
    dispatcher,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://paiblo.github.io",
    },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j));
  return j;
};
const wait = async (fn) => {
  for (let i = 0; i < 300; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Live relay timeout");
};
const connect = (role, token) => {
  const ws = new WebSocket(
    `${base.replace("https", "wss")}/v1/devices/${device}/ws`,
    {
      dispatcher,
      ...(role === "device"
        ? { protocols: ["bruce.v1"], headers: { Origin: "file://" } }
        : {}),
    },
  );
  const messages = [];
  ws.addEventListener("open", () =>
    ws.send(JSON.stringify({ v: 1, type: "auth", role, token })),
  );
  ws.addEventListener("message", (e) => {
    try {
      messages.push(JSON.parse(e.data));
    } catch {
      messages.push(e.data);
    }
  });
  ws.addEventListener(
    "error",
    () => !closing && console.error("WebSocket transport error"),
  );
  return { ws, messages };
};
let d, b;
let closing = false;
try {
  await post("enroll", { token });
  d = connect("device", token);
  await wait(() => d.messages.some((m) => m.type === "ready"));
  d.ws.send(JSON.stringify({ v: 1, type: "pair.open", code: "87654321" }));
  await new Promise((r) => setTimeout(r, 300));
  const p = await post("pair", { code: "87654321" });
  await wait(() => d.messages.some((m) => m.type === "pair.request"));
  assert.equal((await post("claim", { secret: p.secret })).approved, false);
  d.ws.send(JSON.stringify({ v: 1, type: "pair.approve", claim: p.claim }));
  await new Promise((r) => setTimeout(r, 300));
  assert.equal((await post("claim", { secret: p.secret })).approved, true);
  b = connect("browser", p.token);
  await wait(() => b.messages.some((m) => m.type === "ready"));
  const ready = b.messages.find((m) => m.type === "ready");
  const c = {
    v: 1,
    type: "command",
    id: randomUUID(),
    nonce: ready.nonce,
    seq: 1,
    ts: Date.now(),
    method: "device.info",
    params: {},
  };
  b.ws.send(JSON.stringify(c));
  await wait(() => d.messages.some((m) => m.type === "command"));
  d.ws.send(
    JSON.stringify({
      v: 1,
      type: "result",
      id: c.id,
      ok: true,
      data: { board: "EXPLICIT SYNTHETIC TEST; NO HARDWARE" },
    }),
  );
  await wait(() => b.messages.some((m) => m.type === "result" && m.ok));
  b.ws.send(JSON.stringify(c));
  await wait(() => b.messages.some((m) => m.error?.includes("Replay")));
  d.ws.send(JSON.stringify({ v: 1, type: "pair.revoke" }));
  let revoked = false;
  b.ws.addEventListener("close", () => (revoked = true));
  await wait(() => revoked);
  console.log(
    "PASS deployed HTTPS/WSS enrollment, pairing approval, routing, result, replay and revocation (synthetic device only).",
  );
} finally {
  closing = true;
  d?.ws.close();
  b?.ws.close();
  await dispatcher.close();
}
