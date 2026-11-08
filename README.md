# 环宝的健身计划

温柔、轻量的成人健康生活手账。访问：https://gdutboy.github.io/fitness/

- 今天 / 食谱 / 运动 / 记录四个页面，手机优先。
- 28 天确定性菜单，工作日饭堂选菜指南、周末家常午餐。
- 食材与做法、逐餐替换、自动采购清单。
- 三餐、爬楼、力量练习及休息记录；补记和撤销。
- 体感、可选经期、体重与备注，真实趋势，不预填虚假记录。
- 本机保存，JSON 导出 / 验证 / 合并恢复，PWA 离线。

## 运行

需要 Node.js 22+，无第三方运行依赖。

```sh
npm ci
npm run check
npm test
npm run build
npm run dev
```

打开 http://127.0.0.1:4178/fitness/ 。修改代码后重新构建并刷新。

## 数据边界

个人设置第一次使用时填写，仅保存在当前浏览器。公开源码不含真实生日、经期日期或健康日志；不发送分析或追踪请求。不同设备 / 浏览器不同步。清理浏览数据前请导出备份。备份含私人记录，请妥善保管。

恢复时校验 schema、日期、数值和菜单 ID；同日以导入记录为准，其余本机记录保留。不会在恢复失败时覆盖当前数据。

`huanbao.fitness.v1` 为独立存储键；service worker 限定 `/fitness/`，只管理以 `huanbao-fitness-` 开头的缓存。更新资源时一并更新 `sw.js` 中的 CACHE 版本；已打开页面保持旧版，关闭应用所有页面后切换新版。

## 发布

独立 GitHub Pages 仓库。推送 main 后，GitHub Actions 执行语法检查、逻辑测试、静态构建并部署。`_site/` 为生成目录，只包含网页资源。无后端、无需 API Key，不依赖本地常驻服务。

## 健康建议范围

一般成年人的生活方式建议，菜单份量可根据饥饿感与活动调整；不承诺减重速度、不计算虚假精确热量、不预测排卵。运动按体感和恢复调整。

参考：
- https://www.cdc.gov/healthy-weight-growth/physical-activity/index.html
- https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html
- https://womenshealth.gov/getting-active/physical-activity-menstrual-cycle

首页食物图片为 AI 生成；其余图标为本项目代码绘制。
