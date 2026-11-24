import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), false);
const { values } = parseArgs({
  options: {
    port: { type: "string", short: "p", default: process.env.PORT || "3000" },
    hostname: {
      type: "string",
      short: "H",
      default: process.env.HOSTNAME || "127.0.0.1",
    },
  },
});
const server = resolve(".next/standalone/server.js");
if (!existsSync(server))
  throw new Error("Execute npm run build antes de iniciar o servidor SSR.");
if (
  !/^\d+$/.test(values.port) ||
  Number(values.port) < 1 ||
  Number(values.port) > 65535
)
  throw new Error("Porta inválida.");

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: values.port,
    HOSTNAME: values.hostname,
    NEXT_TELEMETRY_DISABLED: "1",
  },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 0));
