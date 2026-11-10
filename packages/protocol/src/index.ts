import { z } from "zod";
export const VERSION = 1;
export const MAX_FRAME = 49152;
export const deviceId = z.string().regex(/^[a-f0-9]{32}$/);
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const pathSchema = z
  .string()
  .min(1)
  .max(180)
  .startsWith("/")
  .refine(
    (p) =>
      !p.includes("..") &&
      !/[\x00-\x1f"\\]/.test(p) &&
      !/bruce\.conf|bridge\.json|nvs|credential|\.bridge-/i.test(p),
    "Geschützter oder ungültiger Pfad",
  );
const drive = z.enum(["SD", "LittleFS"]);
export const positionSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100),
  timestamp: z.number().int(),
  speed: z.number().min(0).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  source: z.literal("phone"),
});
export const params = {
  "device.info": z.object({}),
  "screen.get": z.object({}),
  "input.press": z.object({
    key: z.enum(["up", "down", "prev", "next", "sel", "esc"]),
    duration: z.number().int().min(10).max(1000).default(10),
  }),
  "terminal.run": z.object({
    command: z
      .string()
      .max(160)
      .regex(
        /^(info|free|uptime|date|storage free|rfid info|i2c)$/,
        "Nur Diagnosebefehle sind freigegeben.",
      ),
  }),
  "fs.list": z.object({ drive, path: pathSchema }),
  "fs.read": z.object({
    drive,
    path: pathSchema,
    offset: z.number().int().min(0).max(16777216),
    length: z.number().int().min(1).max(3072),
  }),
  "fs.write": z.object({
    drive,
    path: pathSchema.refine((p) => p.startsWith("/BruceControl/")),
    offset: z.number().int().min(0).max(1048576),
    data: z
      .string()
      .max(4096)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/),
    final: z.boolean(),
  }),
  "fs.rename": z.object({
    drive,
    path: pathSchema.refine((p) => p.startsWith("/BruceControl/")),
    target: pathSchema.refine((p) => p.startsWith("/BruceControl/")),
  }),
  "fs.delete": z.object({
    drive,
    path: pathSchema.refine((p) => p.startsWith("/BruceControl/")),
  }),
  "fs.mkdir": z.object({
    drive,
    path: pathSchema.refine((p) => p.startsWith("/BruceControl/")),
  }),
  "gps.push": positionSchema,
  "display.brightness": z.object({ value: z.number().int().min(1).max(100) }),
  "ir.receive": z.object({ raw: z.boolean(), timeout: z.literal(10) }),
  "ir.send": z.object({
    path: pathSchema.refine(
      (p) => p.startsWith("/BruceControl/") && p.endsWith(".ir"),
    ),
    authorized: z.literal(true),
  }),
} as const;
export type Method = keyof typeof params;
export const methods = Object.keys(params) as Method[];
export const commandSchema = z
  .object({
    v: z.literal(1),
    type: z.literal("command"),
    id: z.string().uuid(),
    nonce: z.string().uuid(),
    seq: z.number().int().positive(),
    ts: z.number().int(),
    method: z.enum(methods as [Method, ...Method[]]),
    params: z.unknown(),
  })
  .superRefine((c, ctx) => {
    if (!params[c.method].safeParse(c.params).success)
      ctx.addIssue({ code: "custom", message: "Ungültige Parameter" });
  });
export type Command = z.infer<typeof commandSchema>;
export type Reply = {
  v: 1;
  type: "result";
  id: string;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
};
export type DeviceInfo = {
  board: string;
  firmware: string;
  bridge: string;
  capabilities: Method[];
  uptime: number;
  heapFree: number;
  heapTotal: number;
  psramFree: number;
  psramTotal: number;
  ip: string;
  ssid: string;
  rssi: number;
  sd: boolean;
  sdTotal?: number;
  sdUsed?: number;
  fsTotal: number;
  fsUsed: number;
  battery?: number;
  gps?: {
    lat: number;
    lon: number;
    timestamp: number;
    satellites?: number;
    hdop?: number;
  };
};
export function fresh(ts: number, now = Date.now()) {
  return Number.isFinite(ts) && Math.abs(now - ts) <= 30000;
}
export function randomHex(bytes = 32) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function timingEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export class Budget {
  private tokens: number;
  private at: number;
  constructor(
    private capacity = 60,
    private perSecond = 10,
    now = Date.now(),
  ) {
    this.tokens = capacity;
    this.at = now;
  }
  take(now = Date.now()) {
    this.tokens = Math.min(
      this.capacity,
      this.tokens + ((now - this.at) * this.perSecond) / 1000,
    );
    this.at = now;
    if (this.tokens < 1) return false;
    this.tokens--;
    return true;
  }
}
