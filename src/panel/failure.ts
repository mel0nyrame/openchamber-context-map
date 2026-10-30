export interface HostFailureCopy {
  title: string;
  detail: string;
}

/** 把 host 层的错误码翻译成面板文案；未知错误统一指向 Settings → Extensions。 */
export function describeHostFailure(code: string | null): HostFailureCopy {
  if (code === "NO_SERVICE" || code === "NOT_GRANTED") {
    return {
      title: "Service 未就绪",
      detail: "在 Settings → Extensions 中授权并启用 Context Map 的 Service。",
    };
  }
  if (code === "DISABLED") {
    return {
      title: "Context Map 已暂停",
      detail: "在 Settings → Extensions 中重新启用。",
    };
  }
  if (code === "SERVICE_FAILED") {
    return {
      title: "Service 已停止",
      detail: "在 Settings → Extensions 中重新启用，或重启 OpenChamber。",
    };
  }
  return {
    title: "无法连接 Service",
    detail: "请确认 OpenChamber 正在运行，然后在 Settings → Extensions 中检查 Context Map。",
  };
}
