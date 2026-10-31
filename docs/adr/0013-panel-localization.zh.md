# 面板文案以英文为源语言，跟随宿主语言回退

面板的每一条可见文案都放在 `src/panel/i18n.ts` 的字典里，渲染代码只通过 `t(locale, key, vars)` 取值。`en` 是源语言，`zh` 是翻译；宿主 `ready` 里的 `locale` 以 `zh` 开头时用中文，其余一律回退英文。日期与数字格式也跟随同一个 locale。

英文作为源语言，与代码标识符、GitHub issue、README 和发布说明保持同一套措辞，翻译只需要维护一份中文。回退到英文而不是跟随系统语言，是因为宿主已经把用户选择的语言通过 `HostReadyContext.locale` 传进来，面板再读系统偏好会与 OpenChamber 界面不一致。

**Considered options**

- 每条文案写成 `locale === "zh" ? "中文" : "English"`：分散在渲染代码里，漏改与拼写漂移难以发现。
- 引入运行时翻译库：只有两种语言、几十条文案，字典加类型约束已经够用。
- 读 `navigator.language`：会忽略用户在 OpenChamber 里的语言设置。

**Consequences**

新增文案必须同时补 `en` 与 `zh`；`Record<MessageKey, string>` 会让漏翻译在 `bun run typecheck` 时报错。专有名词（Context map、Breakdown、Window、Fit、Preview、Collector）在中文里保留英文。README 与 ADR 以英文为主，中文版使用 `.zh.md` 后缀；`docs/agents/` 用英文，`docs/` 下其余内部文档用中文。
