# 环宝的健身计划

温柔、轻量的成人健康生活手账。访问：https://gdutboy.github.io/fitness/

- 今天 / 食谱 / 运动 / 记录四个页面，手机优先。
- 28 天确定性菜单，工作日饭堂选菜指南、周末家常午餐。
- 食材与做法、逐餐替换、自动采购清单。
- 三餐、爬楼、力量练习及休息记录；补记和撤销。
- 体感、可选经期、体重与备注，真实趋势，不预填虚假记录。
- 后台自动保存、打开自动读取；本机离线缓存、断网补传；JSON 导出 / 验证 / 合并恢复，PWA 离线。

## 运行

需要 Node.js 22+，无第三方运行依赖。

```sh
npm ci
npm run check
npm test
npm run build
npm run dev
```

打开 http://127.0.0.1:4178/fitness/ 。本地开发只连接同源测试接口，数据存 `.fitness-test-data/`（已忽略），不会写入生产后台。修改代码后重新构建并刷新。

## 数据边界

单人免登录模式，所有设备读取同一份后台记录。个人设置、三餐、运动、体重、体感、经期、备注和采购清单均自动同步。打开网址、回到前台、网络恢复时自动读取，编辑后约半秒上传；前台每分钟刷新。网页显示同步状态，失败时不会提示已同步。离线修改留在本机，下次打开或联网后补传；第一次升级会合并原有本机记录。

接口为 `https://xiulian-sync.gdutboy.xyz/v1/fitness/data`，数据独立存于 HB 数据目录的 `fitness/`，不混用修炼日记数据。按使用者要求，无注册、登录或访问口令；持有网址者可读取和修改这份记录。公开源码只含程序和菜单，不含实际记录，不发送分析或追踪请求。

客户端以最后成功同步的快照逐字段合并，新设备空白状态不会覆盖后台；同一字段双方都改动时，本次上传的本机改动优先。服务器用版本号拒绝过时整包覆盖，客户端重新读取后合并重试；撤销和清空体重也会传播。现代浏览器通过 Web Locks 串行同源标签页同步。服务器原子写文件并保留最近 30 个历史版本。
恢复时校验 schema、日期、数值和菜单 ID；同日以导入记录为准，其余本机记录保留。不会在恢复失败时覆盖当前数据。

`huanbao.fitness.v1` 为独立存储键；service worker 限定 `/fitness/`，只管理以 `huanbao-fitness-` 开头的缓存。更新资源时一并更新 `sw.js` 中的 CACHE 版本；已打开页面保持旧版，关闭应用所有页面后切换新版。

## 发布

独立 GitHub Pages 仓库。推送 main 后，GitHub Actions 执行语法检查、逻辑测试、静态构建并部署。`_site/` 为生成目录，只包含网页资源。静态网页不需要 API Key；自动同步使用 HB 既有同步服务。后台代码和部署步骤见 `server/README.md`。必须先部署并验收后台接口，再发布前端。

## 健康建议范围

一般成年人的生活方式建议，菜单份量可根据饥饿感与活动调整；不承诺减重速度、不计算虚假精确热量、不预测排卵。运动按体感和恢复调整。

参考：
- https://www.cdc.gov/healthy-weight-growth/physical-activity/index.html
- https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html
- https://womenshealth.gov/getting-active/physical-activity-menstrual-cycle

首页食物图片为 AI 生成；其余图标为本项目代码绘制。
