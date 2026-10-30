import type { Category } from "../shared/types.ts";

/**
 * 分类的界面名称。GLOSSARY 里的英文名是标识符；面板文案是中文，
 * 悬停提示与 Breakdown 使用这里的显示名。
 */
export const CATEGORY_LABELS: Record<Category, string> = {
  system: "系统提示",
  toolDefinitions: "工具定义",
  userMessages: "用户消息",
  assistantText: "助手文本",
  reasoning: "推理",
  toolCalls: "工具调用",
  toolResults: "工具结果",
  other: "其他",
};
