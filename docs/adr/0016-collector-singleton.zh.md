# 每个进程只运行一个 Collector，且只删除自己的 discovery 记录

OpenCode 每打开一个工作区或 location 就会重新加载插件。一次 `opencode serve` 进程的运行中，`setup()` 被调用 11 次，同时有 5 个 Collector 实例监听 5 个端口。所有实例都用同一个 discovery 路径 `discoveryFileName(process.pid)`，后写的一次覆盖前一次。之后任意一次 cleanup 都会删掉这个共享文件，包括已被替换的实例的 cleanup。Service 找不到 discovery 条目，返回 `not_found`，面板一直停在「等待第一次请求」，直到重启 OpenChamber，因为该文件在每个 Collector 生命周期里只写一次，之后不会重建。

Service 还有第二种丢失活记录的方式：`resolveRoute` 会删除每个 1 秒探活失败的 discovery 文件，且不检查删除时刻文件描述的是哪个实例。

**Decision**

- `setup()` 加入进程内唯一的 Collector。每次调用在 `open` 里持有一张票据；只有最后一张票据释放后 Collector 才关闭，所有 cleanup 都等同一个关闭流程结束。因此重新加载会复用同一个端口、同一个 token、同一个 discovery 文件，`context` hook 也只注册一次。
- 这个 Collector 的登记表放在 `globalThis` 上，键为 `Symbol.for("openchamber-context-map.collector")`，不放模块作用域。OpenCode 会在同一进程里多次求值插件模块：重启后一次运行记录了 24 次加载，进程里仍有两个由不同模块实例启动的 Collector。模块级变量看不到另一个模块实例，`globalThis` 可以。
- 票据和「handle 仍可用」的检查在同一个同步块里完成，并用一个 `closing` promise 拦住新的启动。`setup()` 原先在 `await ensureCollector(...)` 之后才加票据；cleanup 若在这段间隙里清空集合，Collector 会关闭，新票据就落在已关闭的句柄上：服务已关、discovery 文件已删、没有活动的 Collector，面板一直显示 `not_found` 直到重启。现在若 `setup()` 到达时上一个 Collector 正在关闭，它会等关闭结束再启动，因此旧 cleanup 删除文件时不会有新记录写入。
- `removeDiscovery(file, owner)` 只在文件仍描述同一个 Collector（`pid`、`port`、`token` 都相同）时删除。Collector 传入自己的记录，Service 传入刚探活过的那条记录，因此探活期间被新实例重写的记录不会被误删。

**Considered options**

- 给每个实例唯一文件名（`collector-<pid>-<random>.json`）：消除了覆盖，但同一进程里的多个活 Collector 会各有独立的 store 和 token，并重复注册 hook，一条请求会被计算多次，Service 还会去探活已死的条目。
- 拒绝第二次 `setup()`：重新加载后面板拿不到 Collector 的句柄，而第一次加载的 cleanup 仍可能稍后到达并把它停掉。
- 继续无条件删除，只依赖「只写一次」：重新加载后目录里会留下一个已不存在 Collector 的记录，每次请求都要探活它，直到进程退出。
- 让 Service 不删除失败记录：死记录会不断累积，每次请求都要付它们的探活超时。

**Consequences**

`collector-<pid>.json` 仍然是一个进程一个文件，这个命名现在才名副其实。记录描述已停止 Collector 的情况只剩进程未执行 cleanup 就退出；Service 在探活失败后删除它，归属校验保证不会误删更新的记录。进程启动后的第一次 `setup()` 决定插件上下文，同一进程内后续调用复用它。

还有一种很窄的情况会丢掉活记录：Service 读到一条记录、1 秒探活失败，进程在这之后、unlink 之前启动了新 Collector，于是 unlink 删掉了更新的记录。归属校验把风险压缩到「读文件到 unlink」这段窗口，`closing` 闸门则让进程内的写入不进这段窗口。要彻底消除需要原子接管（rename、校验、失败回滚），代价高于剩余风险。

票据不会过期。若某个模块实例从不执行 cleanup，Collector 会常驻到进程退出；旧设计里该实例能自行停掉。宿主在重载和退出时都会执行 cleanup，因此这只在宿主出问题时才成立。

后加载的模块实例只给共享句柄加一张票据，不注册 hook，也不监听端口。它的 cleanup 通过拥有该句柄的模块的 `dispose` 停掉 Collector —— 只有那份代码持有 server、hook 和 writer。
