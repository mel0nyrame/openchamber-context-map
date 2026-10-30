// 不安装 OpenChamber 也能跑通的开发链路：
// Collector（进程内）→ Service（子进程）→ 面板（iframe + 最小 host 桥）。
// 用法：bun run build && bun run dev
import { randomBytes } from "node:crypto";
import { spawn } from "bun";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import collector from "../src/collector/main.ts";
import { SERVICE_PORT_ENV, SERVICE_TOKEN_ENV } from "../src/shared/version.ts";

const CHANNEL = "openchamber.sdk";
const API_VERSION = 1;
const ROOT = join(import.meta.dir, "..");

async function freePort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

const discoveryDir = await mkdtemp(join(tmpdir(), "context-map-dev-"));
process.env.CONTEXT_MAP_DISCOVERY_DIR = discoveryDir;

const disposeCollector = await collector.setup({});
const serviceToken = randomBytes(32).toString("hex");
const servicePort = await freePort();

const service = spawn(["bun", "src/service/main.ts"], {
  cwd: ROOT,
  env: {
    ...process.env,
    [SERVICE_PORT_ENV]: String(servicePort),
    [SERVICE_TOKEN_ENV]: serviceToken,
  },
  stdout: "inherit",
  stderr: "inherit",
});

const deadline = Date.now() + 5_000;
let ready = false;
while (Date.now() < deadline) {
  try {
    const response = await fetch(`http://127.0.0.1:${servicePort}/health`, {
      headers: { Authorization: `Bearer ${serviceToken}` },
    });
    if (response.status === 200) {
      ready = true;
      break;
    }
  } catch {
    // Service 还没开始监听。
  }
  await Bun.sleep(50);
}
if (!ready) {
  service.kill();
  await disposeCollector();
  throw new Error("Service 未能在 5 秒内启动");
}

const themeTokens = {
  background: "#ffffff",
  elevated: "#ffffff",
  foreground: "#1f2328",
  muted: "#656d76",
  subtle: "#f6f8fa",
  border: "#d0d7de",
  hover: "#f3f4f6",
  selection: "#dbeafe",
  focus: "#93c5fd",
  primary: "#2563eb",
  mutedSurface: "#f6f8fa",
  elevatedForeground: "#1f2328",
  active: "#eef2f7",
  selectionForeground: "#1f2328",
  primaryForeground: "#ffffff",
  primaryText: "#1d4ed8",
  successText: "#166534",
  warningText: "#92400e",
  errorText: "#991b1b",
  infoText: "#1e40af",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
  font: "system-ui, -apple-system, sans-serif",
  mono: "ui-monospace, SFMono-Regular, monospace",
  radius: "8px",
};

const harness = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Context Map · 开发预览</title>
<style>
  html, body { margin: 0; height: 100%; background: #fff; }
  iframe { display: block; width: 100%; height: 100%; border: 0; }
</style>
</head>
<body>
<iframe id="panel" src="/panel/index.html"></iframe>
<script>
  const CHANNEL = ${JSON.stringify(CHANNEL)};
  const API_VERSION = ${API_VERSION};
  const frame = document.getElementById("panel");
  const ready = {
    channel: CHANNEL,
    v: API_VERSION,
    type: "ready",
    payload: {
      surface: "panel",
      locale: "zh-CN",
      theme: { mode: "light", tokens: ${JSON.stringify(themeTokens)} },
      features: {},
      session: null,
      connection: null,
      settings: null,
      directory: null,
    },
  };

  const reply = (id, payload) => frame.contentWindow.postMessage({
    channel: CHANNEL, v: API_VERSION, type: "result", id, ok: true, payload,
  }, "*");

  // hello 可能早于本脚本注册监听；load 时补发一次 ready。
  frame.addEventListener("load", () => frame.contentWindow.postMessage(ready, "*"));

  window.addEventListener("message", async (event) => {
    if (event.source !== frame.contentWindow) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL || message.v !== API_VERSION) return;

    if (message.type === "hello") {
      frame.contentWindow.postMessage(ready, "*");
      return;
    }

    if (message.type === "service-status") {
      reply(message.id, { status: "ready" });
      return;
    }

    if (message.type === "service-request") {
      const request = message.payload;
      try {
        const init = { method: request.method || "GET" };
        if (request.body !== undefined) {
          init.headers = { "Content-Type": "application/json" };
          init.body = request.body;
        }
        const response = await fetch("/__service?path=" + encodeURIComponent(request.path), init);
        const result = await response.json();
        reply(message.id, { status: result.status, body: result.body });
      } catch (error) {
        frame.contentWindow.postMessage({
          channel: CHANNEL, v: API_VERSION, type: "result", id: message.id,
          ok: false, code: "SERVICE_FAILED", error: String(error),
        }, "*");
      }
    }
  });
</script>
</body>
</html>`;

const previewPort = await freePort();
const preview = Bun.serve({
  hostname: "127.0.0.1",
  port: previewPort,
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/" || path === "/index.html") {
      return new Response(harness, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (path === "/panel/index.html") return new Response(Bun.file(join(ROOT, "panel/index.html")));
    if (path === "/panel/main.js") return new Response(Bun.file(join(ROOT, "panel/main.js")));
    if (path === "/__service") {
      const target = url.searchParams.get("path") ?? "/";
      if (!target.startsWith("/") || target.startsWith("//")) {
        return Response.json({ status: 400, body: JSON.stringify({ error: "bad_path" }) });
      }
      return fetch(`http://127.0.0.1:${servicePort}${target}`, {
        method: request.method,
        headers: { Authorization: `Bearer ${serviceToken}` },
        body: request.method === "GET" ? undefined : await request.text(),
      }).then(async (response) => Response.json({
        status: response.status,
        body: await response.text(),
      }));
    }
    return new Response("not found", { status: 404 });
  },
});

console.log(`Context Map 开发预览：http://127.0.0.1:${previewPort}`);
console.log(`Service：127.0.0.1:${servicePort}；discovery：${discoveryDir}`);

let stopping = false;
async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  preview.stop(true);
  service.kill();
  await service.exited;
  await disposeCollector();
  await rm(discoveryDir, { recursive: true, force: true });
  process.exit(0);
}

process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
