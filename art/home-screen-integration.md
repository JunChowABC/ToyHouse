# 主界面 V2 接入说明

## 美术与装配

来源为 `outputs/20260919_home_psd_v2_art_slogan/toyhouse-home-layered-v2-art-slogan.psd` 及同目录已验证的 `psd-manifest.json`、`layers/`。图片是 ImageGen 重建资源，不承诺与原始截图逐像素相同。

`scripts/export-home-art.mjs` 校验源验证报告和图层 SHA256，导出 89 张独立 PNG 到 `assets/home-v2/`，生成资源清单及 `src/home-art-manifest.js`。`src/home-screen.js` 按源 941×1672 坐标统一等比映射到 540×960 逻辑画布，逐层绘制。标题、标语保留 PNG 美术字，11 项普通文字使用运行时绘制，其中进度和开始按钮文案随状态更新。

## 核心玩法货币资源复用

首页不导出、不加载源 PSD 中的 `ui_star_bar`、`ui_star_icon`、`ui_coin_bar`、`ui_coin_icon`，也不使用其示例货币数字。首页和关卡共用 `src/game.js` 中的 `drawCurrencyHud`，直接使用 `assets/toyhouse-ui-v3/` 的同一批 Image 对象、坐标和尺寸：

- `ui_resource_bar_base_01_instance_01`
- `ui_resource_bar_base_01_instance_02`
- `ui_resource_star_icon_01_instance_01`
- `ui_resource_coin_icon_01_instance_01`

金币显示 `profile.coins`；钻石（星彩）经济未实现，按最新要求统一显示 0。首页按主界面 MDD 不显示加号、无货币点击操作；局内沿用既有显示行为。

## 交互与边界

从存档完成关卡 ID 计算首个待通关关卡和章节内关卡号。未通关退出不推进，通关后返回首页显示更新后的余额与进度；刷新后保留。全部 20 关完成后开始按钮为禁用的“今晚好梦”，进度文案为“更多夜晚准备中”，设置仍可打开。

首页设置使用既有弹窗素材，音乐、音效、震动共用局内设置和 `toyhouse-settings-v1` 存档；弹窗阻断底层点击和开始快捷键。未新增背景音乐音频，音乐开关保留既有设置语义。未提供章节房间变体资源，本次不实现按章节更换房间美术。

## 验证与构建

本次通过 `verify-home-art.mjs`、`verify-v3-art.mjs`、`verify-complete-dialog.mjs`、`verify-pause-art.mjs`，以及 develop-web-game 标准 Playwright 客户端。覆盖源码 540×960、发布版 390×844 DPR2、发布版 1024×768，实际 Canvas 调用验证全部首页图层边界及四个共享货币对象。验证设置持久化、弹窗防穿透、奖励后返回、刷新、全部通关禁用状态，无页面或资源错误。

首页报告和实际浏览器截图位于 `test-output/home-v2/`，已人工检查首页、设置、局内及全通关画面。通关流程包含 QA 清关夹具，本次未重新执行全部 20 关真实输入解法测试。

运行 `node scripts/export-home-art.mjs` 重新导出，`npm run build` 构建本地 `docs/`，启动服务器后运行 `npm run test:home`。已同步本地发布资源，未推送或部署线上。
