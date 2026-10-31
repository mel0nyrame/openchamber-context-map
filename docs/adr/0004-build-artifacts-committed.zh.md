# 构建产物随源码提交

`panel/main.js`、`service/main.js`、`collector/main.js` 是构建产物，仍然提交进仓库。OpenChamber 安装扩展时只读取文件夹里的 `package.json` manifest 与入口文件，不执行构建：`contributes.service` 直接 spawn `service/main.js`，panel 直接加载 `panel/index.html`。产物只留在本地会让装出来的扩展缺文件或跑旧代码。`scripts/build.ts` 用 `openchamber-guest-bundle` 生成三者，panel 是 IIFE（沙箱 iframe 不能加载 ES module），service 与 collector 是 target node 的 ESM。

**Considered options**

- 安装时构建：需要 host 执行包管理器和构建脚本，安装路径与权限都不保证，构建失败会变成安装失败。
- 发布时打包成 tarball：多一条发布链路，而当前安装方式就是指向文件夹或 Git 仓库。

**Consequences**

改 `src/` 后必须重新构建并提交产物，否则仓库里的扩展与源码不一致。目前没有 CI 校验产物新鲜度，只能靠提交前跑 `bun run build` 后 `git status` 为空来确认。
