#!/usr/bin/env node
// Launches `next dev` / `next start` on the port defined by APP_PORT in .env.
// Usage: node scripts/serve.mjs <dev|start> [...extra next args]
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readEnvPort() {
  if (process.env.APP_PORT) return process.env.APP_PORT.trim();
  for (const file of [".env.local", ".env"]) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      // Tolerates spacing such as `APP_PORT = 7676` and optional quotes.
      const match = line.match(/^\s*(?:export\s+)?APP_PORT\s*=\s*["']?(\d+)["']?\s*(?:#.*)?$/);
      if (match) return match[1];
    }
  }
  return null;
}

const [mode = "dev", ...rest] = process.argv.slice(2);
const port = readEnvPort();
if (!port) {
  console.error("APP_PORT is not set in .env — add e.g. `APP_PORT=7676`.");
  process.exit(1);
}

const nextBin = resolve(root, "node_modules", "next", "dist", "bin", "next");
console.log(`▲ Darkroom → next ${mode} on http://localhost:${port}`);
const child = spawn(process.execPath, [nextBin, mode, "-p", port, ...rest], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PORT: port, APP_PORT: port },
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
