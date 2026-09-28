# Combo进度条替换

本次视觉来源为 `outputs/login-screen-layered-v1/login-screen-layered-v1.psd`，不是另一个任务的 `loading-layered-v1`。用户要求核心玩法Combo条采用此版进度条，去掉外围星星和光点。

## 资源

`scripts/export-combo-login-art.py` 从已交付独立PNG导出11个部件到 `assets/combo-login-v1/`：外框、空槽、粉色填充、兔耳星形游标、七颗条内星星。仅去除各PNG已有的2px透明留边，未修改PSD或重新绘制美术。

外围星星、光点、环绕粒子及Loading专属装饰不参与Combo绘制；旧 `combo_sparkle_1/2` 从运行清单移除。保留Combo美术字与动态数字。

HUD宽度保持466个设计像素、水平位置保持x=238。为给兔耳游标与Combo文字留出间隔，外框top设为212个设计像素。各部件按同一比例缩放；填充与条内星星按剩余8秒窗口裁切，游标随填充末端移动，限制在轨道内。计数、奖励、暂停、过期及重开逻辑未修改。

核心UI导出器会在完成原有导出后调用Combo导出器，防止重新导出覆盖本次资源。运行图集及本地 `docs/` 已重建。

## 验证

- `tests/verify-core-ui-v4.mjs`：源码540×960、构建390×844、构建1024×768均通过；真实玩具出场触发Combo12，检查新资源身份、外围装饰缺席、游标随半程倒计时移动、暂停冻结、过期隐藏、重开回到Combo1，以及工具按钮交互。
- 11张源资源与docs副本一致。
- 标准develop-web-game客户端运行通过，已查看游戏中截图，无控制台错误产物。
- 网络专项检查：源码及构建版均无资源错误；11个Combo部件均使用图集，独立Combo图片请求0。
- 通用 `verify-runtime-atlas.mjs` 的旧计数断言仍报14≠11：缺少此前新增的3张道具/广告v3图片请求。已确认差异仅为 `ui_rewarded_ad_v3.png`、`ui_tool_ad_pink_v3.png`、`ui_tool_buy_yellow_v3.png`，与本次Combo替换无关，未改动该通用断言。

截图：`test-output/core-ui-v4/390-combo12.png`、`390-login-track-half.png`；网络记录：`combo-network-report.json`。

后续双端同步已补齐独立Maker的Combo画面和数字布局；通用网络断言已纳入已声明的3张广告图片。验证和发布范围见 `art/publish-20260928-latest.md`。
