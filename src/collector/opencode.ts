/**
 * OpenCode V2 插件接口的结构化子集。
 * 只声明采集器真正读取的字段，避免把宿主 SDK 拖进构建产物。
 */

export interface ModelRef {
  providerID: string;
  modelID: string;
  variant?: string;
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

export interface SessionApi {
  hook?: (
    name: string,
    callback: (context: SessionContext) => void | Promise<void>,
    options?: unknown,
  ) => Promise<{ dispose: () => Promise<void> }>;
  context?: (input: { sessionID: string }) => Promise<SessionMessageInfo[] | unknown>;
}

export interface ModelApi {
  list?: () => Promise<ModelListOutput | ModelInfo[] | unknown>;
}

export interface PluginContext {
  session?: SessionApi;
  model?: ModelApi;
}
