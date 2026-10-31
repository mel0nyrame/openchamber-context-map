# Panel copy uses English as the source language and follows the host locale with fallback

Every visible string in the panel lives in the dictionary in `src/panel/i18n.ts`, and rendering code reads it only through `t(locale, key, vars)`. `en` is the source language and `zh` is a translation; when `locale` in the host's `ready` starts with `zh`, the panel uses Chinese, and every other value falls back to English. Date and number formatting follow the same locale.

Using English as the source language keeps one set of terms across code identifiers, GitHub issues, the README, and release notes, and only one Chinese translation needs maintenance. The fallback goes to English rather than the system language because the host already passes the user's chosen language through `HostReadyContext.locale`; reading the system preference in the panel would disagree with the OpenChamber interface.

**Considered options**

- Write every string as `locale === "zh" ? "中文" : "English"`: scattered through rendering code, missed updates and spelling drift are hard to find.
- Add a runtime translation library: with only two languages and a few dozen strings, a dictionary plus type constraints is enough.
- Read `navigator.language`: ignores the language the user set in OpenChamber.

**Consequences**

New copy must be added to both `en` and `zh`; `Record<MessageKey, string>` makes a missing translation fail `bun run typecheck`. Proper nouns (Context map, Breakdown, Window, Fit, Preview, Collector) stay in English in Chinese. The README and ADRs are primarily English, with Chinese versions under the `.zh.md` suffix. `docs/agents/` is English; other internal docs under `docs/` are in Chinese.
