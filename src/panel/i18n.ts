import type { Category } from "../shared/types.ts";

export type Locale = "en" | "zh";

/**
 * 宿主给的是 BCP 47 语言标签，面板只支持英文与中文两种。
 * 任何 zh 变体都落到 zh，其余语言一律回到源语言 en。
 */
export function resolveLocale(tag: string | undefined): Locale {
  return typeof tag === "string" && tag.toLowerCase().startsWith("zh") ? "zh" : "en";
}

const en = {
  refresh: "Refresh",
  retry: "Retry",
  retrying: "Retrying…",
  refreshFailedTitle: "Refresh failed",
  versionOutdatedTitle: "Collector version is outdated",
  versionOutdatedBody:
    "Collector is running {version}; this extension expects {expected}. Update the Collector manually; it will not update automatically.",
  usageTitle: "Context usage",
  estimatedBadge: "estimated",
  estimatedTitle:
    "Some numbers are estimated from characters because the provider did not return complete token usage.",
  assumedWindowBadge: "assumed window",
  assumedWindowTitle: "The model window was unavailable; using 200,000 tokens.",
  baselineBadge: "baseline",
  baselineTitle:
    "Baseline from the most recent real request. The first request in this session will replace it.",
  usedLabel: "Used",
  updatedToday: "Updated {clock}",
  updatedOtherDay: "Updated {month}/{day} {clock}",
  restoredSuffix: " · last run",
  collectedAtTitle: "Collected at {date}",
  mapTitle: "Context map",
  mapHint: "Hover or click a cell to inspect its composition",
  mapAria: "Context map, drawn by used tokens",
  listSeparator: "; ",
  freeSpace: "Free space",
  tokenCount: "{tokens} tokens",
  tokensUnit: "tokens",
  freeCellLabel: "Free space · {tokens} tokens",
  freeLegend: "Free {value}",
  usedLegend: "Used {value}",
  zoomWindow: "Zoom Window {value}",
  zoomFit: "Zoom Fit {value}",
  zoomTitle: "Toggle Window / Fit (Z)",
  overWindow: "over window",
  breakdownTitle: "Breakdown",
  back: "Back",
  drillMeta: "{items} · {tokens} tokens",
  itemCountOne: "1 item",
  itemCountMany: "{items} items",
  drillEmpty: "No items in this category.",
  unnamedItem: "Untitled item",
  itemChars: "{chars} chars",
  previewAria: "Item preview",
  previewCopy: "Copy",
  previewCopyAria: "Copy preview text",
  previewBodyAria: "Preview text",
  previewTruncated: " · showing first {chars} chars",
  previewLoading: "Loading preview…",
  previewReadError: "Could not load this item's preview. Try again later.",
  previewBadFormat: "Preview data is malformed.",
  previewMissingNotice: "Snapshot updated; refreshed.",
  previewRestoredUnavailable: "This preview was not kept across restarts. Send a new request to see it again.",
  previewCopied: "Preview text copied.",
  previewCopiedButton: "Copied",
  previewCopyFailed: "Copy failed. Select the preview text manually.",
  statusCheckingTitle: "Connecting to the local Service…",
  statusCheckingDetail: "The Service may take a moment to start the first time.",
  statusConnectedTitle: "Collector connected · {version}",
  statusConnectedDetail:
    "Snapshots are read through the local Service; the bearer never enters the panel.",
  statusOutdatedDetail: "Collector is outdated; this extension expects {expected}.",
  collectorUnreachableTitle: "Collector is not responding",
  collectorUnreachableDetail:
    "The discovery file exists, but the Collector is not responding. Restart OpenCode and try again.",
  collectorNotRunning: "Collector is not running",
  collectorNotRunningDetail:
    "No discovery file was found. Install the Collector to {path} and restart OpenCode.",
  noSessionTitle: "No open session",
  noSessionDetail: "Open a session to see its context usage.",
  summaryTimeoutTitle: "Collector did not respond in time",
  summaryTimeoutDetail:
    "The Service timed out waiting for the Collector. It will retry automatically.",
  summaryUnavailableTitle: "Snapshot is temporarily unavailable",
  summaryUnavailableDetail:
    "The Collector returned an unexpected result. It will retry automatically.",
  waitingForFirstRequestTitle: "Waiting for first request",
  waitingForFirstRequestDetail:
    "The Collector is connected. The first request in this session will populate the map.",
  connectingTitle: "Connecting to Collector…",
  connectingDetail: "The local Service may take a moment to start the first time.",
  unexpectedServiceTitle: "The Service returned an unexpected result",
  unexpectedServiceDetail: "Try again later, or reload the panel.",
  refreshHaltedTitle: "Automatic refresh paused",
  refreshHaltedBody:
    "Three consecutive refreshes failed. Click Refresh to retry.",
  refreshFailedBody:
    "Showing the last collected snapshot. Click Refresh to retry.",
  hostNoServiceTitle: "Service is not ready",
  hostNoServiceDetail:
    "Authorize and enable the Context Map Service in Settings → Extensions.",
  hostDisabledTitle: "Context Map is paused",
  hostDisabledDetail: "Re-enable it in Settings → Extensions.",
  hostStoppedTitle: "Service has stopped",
  hostStoppedDetail: "Re-enable it in Settings → Extensions, or restart OpenChamber.",
  hostUnavailableTitle: "Cannot reach the Service",
  hostUnavailableDetail:
    "Make sure OpenChamber is running, then check Context Map in Settings → Extensions.",
  categorySystem: "System prompt",
  categoryToolDefinitions: "Tool definitions",
  categoryUserMessages: "User messages",
  categoryAssistantText: "Assistant text",
  categoryReasoning: "Reasoning",
  categoryToolCalls: "Tool calls",
  categoryToolResults: "Tool results",
  categoryOther: "Other",
} as const;

export type MessageKey = keyof typeof en;

const zh: Record<MessageKey, string> = {
  refresh: "刷新",
  retry: "重试",
  retrying: "重试中…",
  refreshFailedTitle: "刷新失败",
  versionOutdatedTitle: "Collector 版本过旧",
  versionOutdatedBody:
    "Collector 运行 {version}，扩展期望 {expected}。请手动更新 Collector；不会自动更新。",
  usageTitle: "上下文用量",
  estimatedBadge: "估算",
  estimatedTitle: "部分数字由字符估算，provider 未提供完整 token 用量。",
  assumedWindowBadge: "假定窗口",
  assumedWindowTitle: "没有取得模型窗口，按 200,000 tokens 估算。",
  baselineBadge: "基线",
  baselineTitle: "来自最近一次真实请求的基线；本 session 的第一次请求会替换它。",
  usedLabel: "已用",
  updatedToday: "更新于 {clock}",
  updatedOtherDay: "更新于 {month}月{day}日 {clock}",
  restoredSuffix: " · 上次运行",
  collectedAtTitle: "采集于 {date}",
  mapTitle: "Context map",
  mapHint: "悬停或点击格子查看分类",
  mapAria: "Context map，按已用 token 绘制",
  listSeparator: "；",
  freeSpace: "空闲空间",
  tokenCount: "{tokens} tokens",
  tokensUnit: "tokens",
  freeCellLabel: "空闲空间 · {tokens} tokens",
  freeLegend: "空闲 {value}",
  usedLegend: "已用 {value}",
  zoomWindow: "缩放 Window {value}",
  zoomFit: "缩放 Fit {value}",
  zoomTitle: "切换 Window / Fit（Z）",
  overWindow: "已超出窗口",
  breakdownTitle: "Breakdown",
  back: "返回",
  drillMeta: "{items} · {tokens} tokens",
  itemCountOne: "1 条",
  itemCountMany: "{items} 条",
  drillEmpty: "这个分类没有可列出的条目。",
  unnamedItem: "未命名条目",
  itemChars: "{chars} 字符",
  previewAria: "条目预览",
  previewCopy: "复制",
  previewCopyAria: "复制 Preview 正文",
  previewBodyAria: "Preview 正文",
  previewTruncated: " · 仅显示前 {chars} 字符",
  previewLoading: "正在读取 Preview…",
  previewReadError: "无法读取这条 Item 的 Preview，请稍后重试。",
  previewBadFormat: "Preview 数据格式不正确。",
  previewMissingNotice: "快照已更新，已刷新",
  previewRestoredUnavailable: "这份预览不会跨重启保留；发出新请求后会重新采集。",
  previewCopied: "已复制 Preview 正文。",
  previewCopiedButton: "已复制",
  previewCopyFailed: "复制失败，请手动选择 Preview 正文。",
  statusCheckingTitle: "正在连接本地 Service…",
  statusCheckingDetail: "首次打开面板时，Service 可能需要一点时间启动。",
  statusConnectedTitle: "Collector 已连接 · {version}",
  statusConnectedDetail: "快照会通过本地 Service 读取，bearer 不会进入面板。",
  statusOutdatedDetail: "Collector 版本过旧，扩展期望 {expected}。",
  collectorUnreachableTitle: "Collector 没有响应",
  collectorUnreachableDetail: "发现文件存在，但 Collector 没有响应。重启 OpenCode 后再试。",
  collectorNotRunning: "Collector 未运行",
  collectorNotRunningDetail:
    "没有找到 Discovery file。把 Collector 安装到 {path} 后重启 OpenCode。",
  noSessionTitle: "没有打开的 session",
  noSessionDetail: "打开一个 session 后，这里会显示它的上下文占用。",
  summaryTimeoutTitle: "Collector 没有及时响应",
  summaryTimeoutDetail: "Service 等待 Collector 超时，稍后会自动重试。",
  summaryUnavailableTitle: "快照暂时不可用",
  summaryUnavailableDetail: "Collector 返回了意外结果，稍后会自动重试。",
  waitingForFirstRequestTitle: "等待第一次请求",
  waitingForFirstRequestDetail:
    "Collector 已连接。在本 session 发起第一次请求后，这里会显示上下文构成。",
  connectingTitle: "正在连接 Collector…",
  connectingDetail: "首次打开面板时，本地 Service 可能需要一点时间启动。",
  unexpectedServiceTitle: "Service 返回了意外结果",
  unexpectedServiceDetail: "请稍后重试，或重新加载面板。",
  refreshHaltedTitle: "自动刷新已暂停",
  refreshHaltedBody: "连续 3 次自动刷新失败。恢复后点「刷新」重试。",
  refreshFailedBody: "显示的是上次采集的快照。点「刷新」重试。",
  hostNoServiceTitle: "Service 未就绪",
  hostNoServiceDetail: "在 Settings → Extensions 中授权并启用 Context Map 的 Service。",
  hostDisabledTitle: "Context Map 已暂停",
  hostDisabledDetail: "在 Settings → Extensions 中重新启用。",
  hostStoppedTitle: "Service 已停止",
  hostStoppedDetail: "在 Settings → Extensions 中重新启用，或重启 OpenChamber。",
  hostUnavailableTitle: "无法连接 Service",
  hostUnavailableDetail:
    "请确认 OpenChamber 正在运行，然后在 Settings → Extensions 中检查 Context Map。",
  categorySystem: "系统提示",
  categoryToolDefinitions: "工具定义",
  categoryUserMessages: "用户消息",
  categoryAssistantText: "助手文本",
  categoryReasoning: "推理",
  categoryToolCalls: "工具调用",
  categoryToolResults: "工具结果",
  categoryOther: "其他",
};

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, zh };

export const CATEGORY_LABEL_KEYS: Record<Category, MessageKey> = {
  system: "categorySystem",
  toolDefinitions: "categoryToolDefinitions",
  userMessages: "categoryUserMessages",
  assistantText: "categoryAssistantText",
  reasoning: "categoryReasoning",
  toolCalls: "categoryToolCalls",
  toolResults: "categoryToolResults",
  other: "categoryOther",
};

export function t(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = MESSAGES[locale][key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}
