import { bindings, defineConfig, exports } from "cf/config";
export default defineConfig({
  worker: {
    name: "bruce-control-relay",
    entrypoint: "./src/index.ts",
    compatibilityDate: "2026-11-10",
    env: {
      ROOMS: bindings.durableObject({
        worker: "bruce-control-relay",
        exportName: "Room",
      }),
      LIMITER: bindings.rateLimit({
        namespace: "1001",
        simple: { limit: 60, period: 60 },
      }),
      ALLOWED_ORIGINS: bindings.text(
        "https://paiblo.github.io,http://localhost:5173,http://127.0.0.1:5173",
      ),
    },
    exports: { Room: exports.durableObject({ storage: "sqlite" }) },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: false },
      traces: { enabled: true, headSamplingRate: 0.1 },
    },
  },
});
