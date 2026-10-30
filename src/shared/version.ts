export const COLLECTOR_VERSION = "0.1.0";

/** 去掉空白和可选的 `v` 前缀，只用于比较版本是否一致。 */
export function normalizeCollectorVersion(value: string): string {
  return value.trim().replace(/^v/i, "");
}

/** Collector 报告的版本与扩展期望的版本不一致时需要提示，不做自动更新。 */
export function collectorVersionOutdated(
  actual: string,
  expected: string = COLLECTOR_VERSION,
): boolean {
  return normalizeCollectorVersion(actual) !== normalizeCollectorVersion(expected);
}

export const DISCOVERY_DIR_ENV = "CONTEXT_MAP_DISCOVERY_DIR";

export const SERVICE_PORT_ENV = "OPENCHAMBER_SERVICE_PORT";
export const SERVICE_TOKEN_ENV = "OPENCHAMBER_SERVICE_TOKEN";
