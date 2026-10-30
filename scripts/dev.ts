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

const DEV_SESSION = "dev-session";

const captured: { fire: ((context: unknown) => void) | null } = { fire: null };

// 假插件上下文：hook 由 dev 脚本自己触发，provider 用量与模型窗口返回固定值，
// 这样不启动 OpenCode 也能看到完整面板。
const fakeApi = {
  session: {
    hook: async (name: string, callback: (context: unknown) => void) => {
      if (name === "context") captured.fire = callback;
      return {
        dispose: async () => {
          captured.fire = null;
        },
      };
    },
    context: async () => [
      {
        type: "assistant",
        id: "dev-assistant",
        content: [],
        tokens: { input: 18_400, output: 1_200, reasoning: 300, cache: { read: 62_800, write: 4_100 } },
      },
    ],
  },
  model: {
    list: async () => ({
      data: [{ providerID: "anthropic", modelID: "claude-sonnet-4-5", limit: { context: 200_000 } }],
    }),
  },
};

const disposeCollector = await collector.setup(fakeApi);

const SYSTEM_PROMPT = `You are a coding agent working inside a user's repository.
Follow the project conventions in AGENTS.md. Prefer the smallest change that solves the problem.
Ask before destructive operations. Keep replies in the user's language.

${"Tool use policy: read files before editing. Run the test suite after changes.\n".repeat(12)}`;

const TOOL_READ = {
  description: "Read a file from the workspace. Returns numbered lines.",
  parameters: {
    type: "object",
    properties: { path: { type: "string" }, offset: { type: "number" }, limit: { type: "number" } },
    required: ["path"],
  },
};

const TOOL_EDIT = {
  description: "Replace an exact string in a file.",
  parameters: {
    type: "object",
    properties: { path: { type: "string" }, old: { type: "string" }, next: { type: "string" } },
    required: ["path", "old", "next"],
  },
};

const TOOL_BASH = {
  description: "Run a shell command in the workspace.",
  parameters: {
    type: "object",
    properties: { command: { type: "string" }, workdir: { type: "string" } },
    required: ["command"],
  },
};

const READ_RESULT = `     1: import { connectHost } from "@openchamber/sdk";
     2: import { applyHostReady } from "@openchamber/sdk/ui";
     3:
     4: const host = connectHost();
     5: host.onReady((context) => {
     6:   applyHostReady(context, document.documentElement);
     7: });
${"     8: // …\n".repeat(40)}`;

const DEV_FIXTURE = {
  sessionID: DEV_SESSION,
  model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" },
  system: [
    { type: "text", text: SYSTEM_PROMPT },
    { type: "text", text: "Current directory: /Users/dev/project\nToday is Friday." },
  ],
  tools: { read: TOOL_READ, edit: TOOL_EDIT, bash: TOOL_BASH },
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "面板里的地图为什么只画了已用部分？我想同时看到窗口还剩多少。" }],
    },
    {
      role: "assistant",
      content: [
        {
          type: "reasoning",
          text: "用户想知道地图与窗口的关系。先看当前实现，再解释 5px bar 的职责。".repeat(8),
        },
        { type: "tool-call", name: "read", input: { path: "src/panel/map.ts", limit: 120 } },
      ],
    },
    { role: "tool", content: [{ type: "tool-result", name: "read", result: READ_RESULT }] },
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: `地图表达的是已用部分的构成，窗口余量交给下面的 5px bar。
占用低时如果按窗口铺格，分类格子会被压缩到看不清，所以格子总数固定，比例只在地图内部生效。`.repeat(4),
        },
      ],
    },
    {
      role: "user",
      content: [{ type: "text", text: "明白了。那 Free space 在 Breakdown 里为什么单独一行？" }],
    },
  ],
};

captured.fire?.(DEV_FIXTURE);
// 等异步补齐写入 provider 用量与窗口。
await Bun.sleep(150);
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

const darkTokens = {
  ...themeTokens,
  background: "#0f1216",
  elevated: "#171b21",
  foreground: "#e6e9ee",
  muted: "#9aa3ad",
  subtle: "#151a20",
  border: "#2b323b",
  hover: "#1d242c",
  selection: "#1e3a5f",
  focus: "#3b82f6",
  primary: "#3b82f6",
  mutedSurface: "#151a20",
  elevatedForeground: "#e6e9ee",
  active: "#1b222a",
  selectionForeground: "#e6e9ee",
  primaryForeground: "#ffffff",
  primaryText: "#93c5fd",
  successText: "#86efac",
  warningText: "#fcd34d",
  errorText: "#fca5a5",
  infoText: "#93c5fd",
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
  const themeMode = new URLSearchParams(location.search).get("theme") === "dark" ? "dark" : "light";
  const tokens = themeMode === "dark" ? ${JSON.stringify(darkTokens)} : ${JSON.stringify(themeTokens)};
  const frame = document.getElementById("panel");
  const ready = {
    channel: CHANNEL,
    v: API_VERSION,
    type: "ready",
    payload: {
      surface: "panel",
      locale: "zh-CN",
      theme: { mode: themeMode, tokens },
      features: {},
      session: { id: ${JSON.stringify(DEV_SESSION)}, title: "Context Map 开发预览", busy: false, model: "anthropic/claude-sonnet-4-5" },
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
        const query = request.query ? "?" + new URLSearchParams(request.query).toString() : "";
        const response = await fetch("/__service?path=" + encodeURIComponent(request.path + query), init);
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
