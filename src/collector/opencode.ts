/**
 * OpenCode V2 插件接口的结构化子集。
 * 只声明采集器真正读取的字段，避免把宿主 SDK 拖进构建产物。
 */

/**
 * OpenCode 2.2 的 Model.Ref 是 `{ id, providerID, variant? }`；
 * `modelID` 只在 Model.Info 与旧开发夹具里出现。
 */
export interface ModelRef {
  id?: string;
  providerID: string;
  modelID?: string;
  variant?: string;
}

/** 请求里的 model 是 Ref（用 id），session.get 与夹具可能给 modelID。 */
export function modelRefID(ref: ModelRef | null | undefined): string {
  if (!ref) return "";
  if (typeof ref.id === "string" && ref.id) return ref.id;
  if (typeof ref.modelID === "string" && ref.modelID) return ref.modelID;
  return "";
}

export interface SystemPart {
  type: string;
  text?: string;
  cache?: unknown;
  metadata?: unknown;
}

export interface ContentPart {
  type: string;
  text?: string;
  media?: unknown;
  filename?: string;
  name?: string;
  namespace?: string;
  id?: string;
  input?: unknown;
  result?: unknown;
  encrypted?: boolean;
  provider?: string;
  effort?: string;
  previous?: string;
}

export interface SessionMessage {
  id?: string;
  role: string;
  content: ContentPart[];
}

export interface ToolDefinition {
  description?: string;
  input?: unknown;
}

export interface SessionContext {
  readonly sessionID: string;
  agent: string;
  model: ModelRef;
  system?: SystemPart[];
  messages?: SessionMessage[];
  tools?: Record<string, ToolDefinition>;
}

export interface TokenUsage {
  input?: number;
  output?: number;
  reasoning?: number;
  cache?: {
    read?: number;
    write?: number;
  };
}

export interface SessionMessageInfo {
  type?: string;
  tokens?: TokenUsage;
}

export interface ModelInfo {
  id?: string;
  providerID?: string;
  modelID?: string;
  name?: string;
  limit?: {
    context?: number;
  };
}

export interface ModelListOutput {
  data?: ModelInfo[];
}

export interface SessionInfo {
  agent?: string;
  model?: ModelRef;
}

export interface SessionApi {
  hook?: (
    name: string,
    callback: (context: SessionContext) => void | Promise<void>,
    options?: unknown,
  ) => Promise<{ dispose: () => Promise<void> }>;
  context?: (input: { sessionID: string }) => Promise<SessionMessageInfo[] | unknown>;
  get?: (input: { sessionID: string }) => Promise<SessionInfo | unknown>;
}

export interface ModelApi {
  list?: () => Promise<ModelListOutput | ModelInfo[] | unknown>;
}

export interface PluginContext {
  session?: SessionApi;
  model?: ModelApi;
}
