import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const result = spawnSync(
  process.execPath,
  [resolve("node_modules/next/dist/bin/next"), "build"],
  {
    stdio: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  },
);
if (result.status !== 0) process.exit(result.status ?? 1);

// Next standalone intentionally omits these folders. Ship them with the SSR server.
mkdirSync(".next/standalone/.next", { recursive: true });
cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
console.log(
  "Standalone SSR includes public assets, fonts, JavaScript and CSS.",
);
