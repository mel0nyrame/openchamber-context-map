// 不安装 OpenChamber 也能跑通的开发链路：
// Collector（进程内）→ Service（子进程）→ 面板（iframe + 最小 host 桥）。
// 用法：bun run build && bun run dev（手动点「模拟请求」注入快照）
//       bun run dev:fixture（启动即注入固定快照）
import { randomBytes } from "node:crypto";
import { spawn } from "bun";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import collector from "../src/collector/main.ts";
import {
  COLLECTOR_VERSION,
  SERVICE_PORT_ENV,
  SERVICE_TOKEN_ENV,
} from "../src/shared/version.ts";

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
const DEV_SESSION_B = "dev-session-b";

const captured: { fire: ((context: unknown) => void) | null } = { fire: null };

// 假插件上下文：hook 由 dev 脚本自己触发，provider 用量与模型窗口返回固定值，
// 这样不启动 OpenCode 也能看到完整面板。两个 session 用不同的 provider 用量，
// 切换时能一眼看出旧数字有没有残留。
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
    get: async (_input: { sessionID: string }) => ({
      agent: "build",
      model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" },
    }),
    context: async (input: { sessionID: string }) => [
      {
        type: "assistant",
        id: "dev-assistant",
        content: [],
        tokens: input.sessionID === DEV_SESSION_B
          ? { input: 42_000, output: 900, reasoning: 100, cache: { read: 30_000, write: 2_000 } }
          : { input: 18_400, output: 1_200, reasoning: 300, cache: { read: 62_800, write: 4_100 } },
      },
    ],
  },
  model: {
    list: async () => ({
      data: [{ providerID: "anthropic", modelID: "claude-sonnet-4-5", limit: { context: 200_000 } }],
    }),
  },
};

let collectorDispose: (() => Promise<void>) | null = await collector.setup(fakeApi);

async function startCollector(): Promise<void> {
  if (collectorDispose) return;
  collectorDispose = await collector.setup(fakeApi);
}

async function stopCollector(): Promise<void> {
  const dispose = collectorDispose;
  collectorDispose = null;
  await dispose?.();
}

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
  agent: "build",
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

const DEV_FIXTURE_B = {
  ...DEV_FIXTURE,
  sessionID: DEV_SESSION_B,
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "第二个 session：切换后应该立刻看到这里的数字，而不是上一个 session 的。" }],
    },
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: `这是第二个 session 的快照。provider 用量与第一个 session 不同，方便确认切换时旧数字已经清空。
切换 session 后面板会先清空，再拉一次新快照；busy 时才继续每 2 秒轮询。`.repeat(3),
        },
      ],
    },
  ],
};

function fireFixture(sessionID: string): boolean {
  if (!captured.fire) return false;
  captured.fire(sessionID === DEV_SESSION_B ? DEV_FIXTURE_B : DEV_FIXTURE);
  return true;
}

const fixtureMode = process.argv.includes("--fixture");

if (fixtureMode) {
  fireFixture(DEV_SESSION);
  // 等异步补齐写入 provider 用量与窗口。
  await Bun.sleep(150);
}
const serviceToken = randomBytes(32).toString("hex");
const servicePort = await freePort();

let service: ReturnType<typeof spawn> | null = null;
let hostError: string | null = null;
let collectorStuck = false;
let collectorOutdated = false;

async function startService(): Promise<void> {
  if (service) return;
  const child = spawn(["bun", "src/service/main.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      [SERVICE_PORT_ENV]: String(servicePort),
      [SERVICE_TOKEN_ENV]: serviceToken,
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  service = child;

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
    child.kill();
    await child.exited;
    service = null;
    throw new Error("Service 未能在 5 秒内启动");
  }
}

async function stopService(): Promise<void> {
  const child = service;
  service = null;
  if (!child) return;
  child.kill();
  await child.exited;
}

await startService();

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
  body { display: flex; flex-direction: column; }
  #devbar {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
    padding: 8px 10px; border-bottom: 1px solid #d0d7de;
    background: #f6f8fa; color: #1f2328;
    font: 12px/1.4 system-ui, -apple-system, sans-serif;
  }
  #devbar button {
    font: inherit; padding: 4px 8px; border: 1px solid #d0d7de;
    border-radius: 6px; background: #fff; color: inherit; cursor: pointer;
  }
  #devbar button:hover { background: #eef2f7; }
  #devbar .sep { color: #d0d7de; }
  #devstate { margin-left: auto; color: #656d76; }
  #panel { display: block; width: 100%; flex: 1; border: 0; }
</style>
</head>
<body>
<div id="devbar">
  <button data-action="session-a">Session A</button>
  <button data-action="session-b">Session B</button>
  <button data-action="session-none">无 session</button>
  <span class="sep">|</span>
  <button data-action="busy">Busy</button>
  <button data-action="idle">Idle</button>
  <span class="sep">|</span>
  <button data-action="started">开始</button>
  <button data-action="completed">完成</button>
  <button data-action="failure">失败</button>
  <span class="sep">|</span>
  <button data-action="request">模拟请求</button>
  <button data-action="panel-refresh">刷新面板</button>
  <button data-action="double-refresh">连点两次</button>
  <button data-action="service-down">停 Service</button>
  <button data-action="service-up">起 Service</button>
  <button data-action="collector-down">停 Collector</button>
  <button data-action="collector-up">起 Collector</button>
  <span class="sep">|</span>
  <button data-action="host-no-service">NO_SERVICE</button>
  <button data-action="host-not-granted">NOT_GRANTED</button>
  <button data-action="host-disabled">DISABLED</button>
  <button data-action="stuck">Collector 卡住</button>
  <button data-action="outdated">版本过旧</button>
  <button data-action="fault-reset">恢复故障</button>
  <span id="devstate"></span>
</div>
<iframe id="panel" src="/panel/index.html"></iframe>
<script>
  const CHANNEL = ${JSON.stringify(CHANNEL)};
  const API_VERSION = ${API_VERSION};
  const params = new URLSearchParams(location.search);
  const themeMode = params.get("theme") === "dark" ? "dark" : "light";
  const locale = params.get("locale") === "en" ? "en-US" : "zh-CN";
  const tokens = themeMode === "dark" ? ${JSON.stringify(darkTokens)} : ${JSON.stringify(themeTokens)};
  const frame = document.getElementById("panel");
  const stateLabel = document.getElementById("devstate");
  const sessions = {
    a: { id: ${JSON.stringify(DEV_SESSION)}, title: "Context Map 开发预览", busy: false, model: "anthropic/claude-sonnet-4-5" },
    b: { id: ${JSON.stringify(DEV_SESSION_B)}, title: "第二个 session", busy: false, model: "anthropic/claude-sonnet-4-5" },
  };
  let currentName = "Session A";
  let current = { ...sessions.a };
  let hostError = null;
  let collectorStuck = false;
  let collectorOutdated = false;
  let summaryRequests = 0;
  const ready = {
    channel: CHANNEL,
    v: API_VERSION,
    type: "ready",
    payload: {
      surface: "panel",
      locale,
      theme: { mode: themeMode, tokens },
      features: {},
      session: current,
      connection: null,
      settings: null,
      directory: null,
    },
  };

  const send = (type, payload) => frame.contentWindow.postMessage({
    channel: CHANNEL, v: API_VERSION, type, payload,
  }, "*");
  const sendReady = () => frame.contentWindow.postMessage({
    ...ready,
    payload: { ...ready.payload, session: current },
  }, "*");
  const findPanelRefresh = () => frame.contentDocument
    ? Array.from(frame.contentDocument.querySelectorAll("button"))
      .find((node) => {
        const label = node.getAttribute("aria-label");
        return label === "刷新" || label === "Refresh"
          || node.textContent.trim() === "刷新" || node.textContent.trim() === "Refresh";
      })
    : null;
  const renderState = (note) => {
    const base = current ? currentName + " · " + (current.busy ? "busy" : "idle") : "无 session";
    const panelRefreshButton = findPanelRefresh();
    const flags = [
      hostError ? "host:" + hostError : null,
      collectorStuck ? "Collector 卡住" : null,
      collectorOutdated ? "版本过旧" : null,
      summaryRequests > 0 ? "summary 请求 " + summaryRequests : null,
      panelRefreshButton && panelRefreshButton.disabled ? "刷新按钮已禁用" : null,
    ].filter(Boolean).join("，");
    stateLabel.textContent = base + (note ? " · " + note : "") + (flags ? " · " + flags : "");
  };

  const reply = (id, payload) => frame.contentWindow.postMessage({
    channel: CHANNEL, v: API_VERSION, type: "result", id, ok: true, payload,
  }, "*");

  // hello 可能早于本脚本注册监听；load 时补发一次 ready。
  frame.addEventListener("load", sendReady);

  window.addEventListener("message", async (event) => {
    if (event.source !== frame.contentWindow) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL || message.v !== API_VERSION) return;

    if (message.type === "hello") {
      sendReady();
      return;
    }

    if (message.type === "service-status") {
      reply(message.id, { status: "ready" });
      return;
    }

    if (message.type === "service-request") {
      const request = message.payload;
      if (request.path === "/summary") summaryRequests += 1;
      if (hostError) {
        frame.contentWindow.postMessage({
          channel: CHANNEL, v: API_VERSION, type: "result", id: message.id,
          ok: false, code: hostError, error: "开发控制栏模拟的 host 错误",
        }, "*");
        return;
      }
      if (collectorStuck && request.path === "/summary") {
        await new Promise((resolve) => setTimeout(resolve, 3_000));
        reply(message.id, { status: 504, body: JSON.stringify({ error: "collector_timeout" }) });
        return;
      }
      try {
        const init = { method: request.method || "GET" };
        if (request.body !== undefined) {
          init.headers = { "Content-Type": "application/json" };
          init.body = request.body;
        }
        const query = request.query ? "?" + new URLSearchParams(request.query).toString() : "";
        const response = await fetch("/__service?path=" + encodeURIComponent(request.path + query), init);
        const result = await response.json();
        if (collectorOutdated && request.path === "/health" && result.status === 200) {
          try {
            const body = JSON.parse(result.body);
            if (body.collector && body.collector.connected) {
              body.collector.version = "0.0.9";
              body.collector.outdated = true;
              body.collector.expectedVersion = ${JSON.stringify(COLLECTOR_VERSION)};
              result.body = JSON.stringify(body);
            }
          } catch {
            // 保持原响应，方便排查。
          }
        }
        reply(message.id, { status: result.status, body: result.body });
      } catch (error) {
        frame.contentWindow.postMessage({
          channel: CHANNEL, v: API_VERSION, type: "result", id: message.id,
          ok: false, code: "SERVICE_FAILED", error: String(error),
        }, "*");
      }
    }
  });

  document.getElementById("devbar").addEventListener("click", async (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    const action = button && button.dataset.action;
    if (!action) return;
    let note = "";
    if (action === "session-a" || action === "session-b") {
      currentName = action === "session-a" ? "Session A" : "Session B";
      current = { ...sessions[action === "session-a" ? "a" : "b"] };
      send("session", { session: current });
      note = "已切 session";
    } else if (action === "session-none") {
      current = null;
      send("session", { session: null });
      note = "已关闭 session";
    } else if (action === "busy" || action === "idle") {
      if (current) {
        current = { ...current, busy: action === "busy" };
        send("session", { session: current });
      }
    } else if (action === "started" || action === "completed" || action === "failure") {
      if (current) {
        if (action === "started") current = { ...current, busy: true };
        if (action === "completed") current = { ...current, busy: false };
        send("session-lifecycle", { sessionId: current.id, phase: action });
        note = "lifecycle: " + action;
      }
    } else if (action === "request") {
      if (current) {
        await fetch("/__dev/request?session=" + encodeURIComponent(current.id), { method: "POST" });
        note = "已触发采集";
      }
    } else if (action === "panel-refresh") {
      const button = findPanelRefresh();
      if (button) {
        button.click();
        note = "已点面板刷新";
      }
    } else if (action === "double-refresh") {
      const button = findPanelRefresh();
      if (button) {
        button.click();
        button.click();
        note = "已连点两次";
      }
    } else if (action === "service-down") {
      await fetch("/__dev/service/down", { method: "POST" });
      note = "Service 已停";
    } else if (action === "service-up") {
      await fetch("/__dev/service/up", { method: "POST" });
      note = "Service 已起";
    } else if (action === "collector-down") {
      await fetch("/__dev/collector/down", { method: "POST" });
      note = "Collector 已停";
    } else if (action === "collector-up") {
      await fetch("/__dev/collector/up", { method: "POST" });
      note = "Collector 已起";
    } else if (action === "host-no-service" || action === "host-not-granted" || action === "host-disabled") {
      const code = action === "host-no-service"
        ? "NO_SERVICE"
        : action === "host-not-granted" ? "NOT_GRANTED" : "DISABLED";
      await fetch("/__dev/fault?host=" + code, { method: "POST" });
      hostError = code;
      note = "host: " + code;
    } else if (action === "stuck") {
      await fetch("/__dev/fault?stuck=1", { method: "POST" });
      collectorStuck = true;
      note = "Collector 卡住";
    } else if (action === "outdated") {
      await fetch("/__dev/fault?outdated=1", { method: "POST" });
      collectorOutdated = true;
      note = "版本过旧";
    } else if (action === "fault-reset") {
      await fetch("/__dev/fault?reset=1", { method: "POST" });
      hostError = null;
      collectorStuck = false;
      collectorOutdated = false;
      note = "故障已恢复";
    }
    renderState(note);
  });
  renderState();
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
    if (path === "/__dev/request" && request.method === "POST") {
      const sessionID = url.searchParams.get("session") ?? DEV_SESSION;
      return Response.json({ ok: fireFixture(sessionID) });
    }
    if (path === "/__dev/service/down" && request.method === "POST") {
      await stopService();
      return Response.json({ ok: true });
    }
    if (path === "/__dev/service/up" && request.method === "POST") {
      try {
        await startService();
        return Response.json({ ok: true });
      } catch (error) {
        return Response.json({ ok: false, error: String(error) }, { status: 500 });
      }
    }
    if (path === "/__dev/collector/down" && request.method === "POST") {
      await stopCollector();
      return Response.json({ ok: true });
    }
    if (path === "/__dev/collector/up" && request.method === "POST") {
      try {
        await startCollector();
        return Response.json({ ok: true });
      } catch (error) {
        return Response.json({ ok: false, error: String(error) }, { status: 500 });
      }
    }
    if (path === "/__dev/fault" && request.method === "POST") {
      if (url.searchParams.get("reset") === "1") {
        hostError = null;
        collectorStuck = false;
        collectorOutdated = false;
      }
      const host = url.searchParams.get("host");
      if (host !== null) hostError = host;
      const stuck = url.searchParams.get("stuck");
      if (stuck !== null) collectorStuck = stuck === "1";
      const outdated = url.searchParams.get("outdated");
      if (outdated !== null) collectorOutdated = outdated === "1";
      return Response.json({ ok: true, hostError, collectorStuck, collectorOutdated });
    }
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
if (fixtureMode) {
  console.log("已注入固定快照 DEV_FIXTURE；无需真实 OpenCode 请求。");
} else {
  console.log("未注入快照；在页面点「模拟请求」，或改用 bun run dev:fixture。");
}

let stopping = false;
async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  preview.stop(true);
  await stopService();
  await stopCollector();
  await rm(discoveryDir, { recursive: true, force: true });
  process.exit(0);
}

process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
