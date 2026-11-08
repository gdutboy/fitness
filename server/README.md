# 单人同步后台

状态：2026-11-08 经用户确认，后台已部署到 HB；对应前端 v1.1.0 随本次提交发布。

生产复用 HB 的 xiulian-sync Node 服务及已有域名，增加 `/v1/fitness/data`，数据独立位于 `/data/fitness/`。不修改 DNS、隧道或本机 LaunchAgent。本次已获用户明确确认，并仅重启 **HB 的 xiulian-sync 容器**。后续共享服务变更仍遵守工作区确认规则。不要运行 xiulian-stack.sh up（会连隧道一起重建）。

## 发布步骤

1. 只读检查 HB 当前容器挂载、Node 版本、生产 sync-server.mjs；核对与本地基线的差异，保存源文件备份及校验值。
2. 上传本仓库 `server/route.mjs` 到 `/volume1/docker/xiulian-sync/app/fitness/server/route.mjs`；上传 `core.js`、`data.js`、`package.json` 到 `app/fitness/`。这些不包含记录或凭据。
3. 对刚读取的生产文件运行 `install-route.py SOURCE OUTPUT`，生成新文件；检查差异只有 import、route 初始化、精确路径转发三处。检查 Node 语法。不要用本地旧版整个覆盖线上文件。
4. 用户确认后，将新服务文件原子替换到原位，仅重启 xiulian-sync 容器。原数据挂载和配置保留。
5. 只读检查 `/healthz`、健身 GET、CORS 预检、修炼日记旧接口状态。不要输出或拷贝真实健康记录到公共日志，不要用演示记录写生产数据。
6. 后台验收后，在独立 fitness 仓库限定路径提交，推送 main，等待 Pages 发布成功并验证静态资源。
7. 线上出现异常时恢复服务源码备份并仅重启 xiulian-sync。fitness 数据目录留存。前端可提交恢复上一版本文件；不要对根工作区执行 checkout/reset/stash。

## 协议

GET 返回 `{rev,updatedAt,data}`，无数据时 rev=0、data=null；PUT 接收 `{baseRev,data}`，成功返回完整新快照；版本不一致返回 409，格式错误 400，超过 2 MiB 返回 413。读取已有损坏文件或写失败返回 503，不重置记录。外层已有服务负责 CORS、限流及 no-store。

本地 `npm run dev` 提供同源测试接口；`standalone.mjs` 是可选的独立本机测试入口。`npm test` 覆盖真实 HTTP 持久化、跨设备、离线恢复、竞态、撤销、历史保留和损坏保护。
