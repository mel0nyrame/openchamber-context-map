import type { MessageKey } from "./i18n.ts";

/** host 层错误只返回文案 key 和是否阻断正文，面板按当前 locale 渲染。 */
export interface HostFailureCopy {
  titleKey: MessageKey;
  detailKey: MessageKey;
  /** 阻断错误替换正文；非阻断错误只改状态条并保留已有内容。 */
  blocking: boolean;
}

/** 把 host 层的错误码映射到面板文案 key；未知错误统一指向 Settings → Extensions。 */
export function describeHostFailure(code: string | null): HostFailureCopy {
  if (code === "NO_SERVICE" || code === "NOT_GRANTED") {
    return { titleKey: "hostNoServiceTitle", detailKey: "hostNoServiceDetail", blocking: true };
  }
  if (code === "DISABLED") {
    return { titleKey: "hostDisabledTitle", detailKey: "hostDisabledDetail", blocking: true };
  }
  if (code === "SERVICE_FAILED") {
    return { titleKey: "hostStoppedTitle", detailKey: "hostStoppedDetail", blocking: true };
  }
  return { titleKey: "hostUnavailableTitle", detailKey: "hostUnavailableDetail", blocking: false };
}
