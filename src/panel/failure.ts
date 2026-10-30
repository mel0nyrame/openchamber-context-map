import type { MessageKey } from "./i18n.ts";

/** host 层错误只返回文案 key，面板按当前 locale 渲染。 */
export interface HostFailureCopy {
  titleKey: MessageKey;
  detailKey: MessageKey;
}

/** 把 host 层的错误码映射到面板文案 key；未知错误统一指向 Settings → Extensions。 */
export function describeHostFailure(code: string | null): HostFailureCopy {
  if (code === "NO_SERVICE" || code === "NOT_GRANTED") {
    return { titleKey: "hostNoServiceTitle", detailKey: "hostNoServiceDetail" };
  }
  if (code === "DISABLED") {
    return { titleKey: "hostDisabledTitle", detailKey: "hostDisabledDetail" };
  }
  if (code === "SERVICE_FAILED") {
    return { titleKey: "hostStoppedTitle", detailKey: "hostStoppedDetail" };
  }
  return { titleKey: "hostUnavailableTitle", detailKey: "hostUnavailableDetail" };
}
