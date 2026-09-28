# 道具广告获取（2026-09-28）

## 当前交付

- Web 三个道具弹窗：左侧浅奶油黄购买/使用，右侧浅樱花粉「看广告 / 观看后使用」，同一行。使用重新生成的 v3 圆润胶囊底图、奶白高光、浅粉边线和粉紫色程序文字；保留两端半圆，只裁短空白中心后等比缩放。
- 完整观看并关闭广告、回到前台后自动使用：洗牌立即使最多5个可用玩具转向；消除/翻转直接进入目标选择。成功领取先保存，道具实际执行时扣库存并计使用次数，不扣金币；达到每关3次使用上限后禁用广告入口。取消或失败不发奖、不使用。
- 播放期间锁定弹窗关闭、购买、重复点击及键盘操作；180 秒无结果释放锁定；取消、失败、缺失有效收据、重复收据均不发奖励。
- 当前 Web 无广告 SDK：按钮提示「暂无可播放的广告，请稍后再试」，不会用倒计时冒充广告。

## Web 接入约定

宿主提供 `window.toyhouseAds.showRewarded({ placement, toolId, requestId, signal })`，返回 Promise。
只有真实激励广告成功回调才能返回 `{ status: 'completed', receiptId: '平台唯一且稳定的奖励收据' }`；取消返回 `cancelled`，无填充返回 `unavailable`，异常可拒绝 Promise。
相同广告奖励必须复用同一收据；不同观看使用不同收据。适配器应响应 AbortSignal，结束加载或关闭播放。
客户端本地存档只提供游戏内去重，不等同于服务端防作弊。

## Maker 接入状态（2026-09-28 已更新）

- 独立工程：`D:/AI游戏/晚安，玩具屋-Maker`，项目已绑定，主配置存在。
- `get_ad_config`：app_id `941354`，developer_id `429598`，`ad.status=1`，广告变现已生效。
- 开通页面：https://developer.taptap.cn/forge/429598/app/941354/operation/ad-monetization
- 用户明确允许同步配置后，将本项目远端广告字段新增到本地 `@runtime.ad`，回读与审阅副本完全一致；配置广告位为 `1054323`/type 1 和 `1054324`/type 2，SDK自行使用平台配置。
- Maker 已接入 `scripts/RewardedAds.lua`，由 `main.lua` 调用 `sdk:ShowRewardVideoAd`。只有回调 `result.success == true` 才发当前道具1个，调用现有 Save.mark，沿用整数云存档字段。处理请求拒绝、同步失败回调、重复/迟到回调、取消、异常和180秒更新时长超时；广告期间锁定操作并保留失焦弹窗。
- Maker `View.lua` 已同步当前粉黄/粉色胶囊按钮与简洁粗描边广告图标；五张原色/禁用资源位于 `assets/toyhouse-ui-v2/ads/`。
- 已通过实际安装 Lua 的 SDK 回调替身与 main.lua 输入/失焦联调、真实 Save.lua 编码保存失败重试及重载、26个UI场景和4500个动作样本。LSP watch 诊断0错误、123警告（check子命令缺少 emmylua_check，改用现有 emmylua_ls 完成诊断）。UI截图来自Lua绘制指令Canvas回放，不是引擎真机画面。
- 未远程发布、未执行 Maker 构建；TapTap 手机环境的真实广告播放、关闭和奖励入库仍需单独验收。详情 `art/maker-ad-integration.md`。

## Imagegen 资源与提示词

2026-09-28 描边调整：当前运行图为 `assets/tool-dialog-v1/ui_rewarded_ad_v3.png`。基于下述 v2 原图保留全部内容，用 `scripts/outline-rewarded-ad-icon-v3.py` 增加 9px 粉紫色 `#BE8BCD` 外描边；256px 画布、运行位置及尺寸不变。此步为确定性描边处理，未重新生成图像。

广告图标底稿为 v2 简化版：粉紫色圆角视频牌与白色播放三角，无天线、蝴蝶结、星星或电视按钮。经此前用户授权使用官方 Imagegen CLI/API（gpt-image-2/high）重新生成；原图 `output/imagegen/rewarded-ad-icon-v2.png`，透明底稿 `assets/tool-dialog-v1/ui_rewarded_ad_v2.png`，完整提示词 `art/rewarded-ad-icon-v2-prompt.txt`。原图为不透明白底，使用 `scripts/export-rewarded-ad-icon-v2.py` 去除与外部连通的近白背景，保留内部白色播放三角，等比缩放到 256×256 透明画布后使用，不修改按钮布局或奖励规则。

下方为旧版 v1 生成记录（已不用于按钮）：

- 经用户授权使用官方 imagegen CLI/API，请求模型 `gpt-image-2`、high 质量、1024x1024；返回原图实际为 1254x1254 RGBA，保留原始 alpha。
- 原图：`output/imagegen/rewarded-ad-icon-v1.png`。
- 运行图：`assets/tool-dialog-v1/ui_rewarded_ad_v1.png`，256x256，等比 LANCZOS 缩放，未重绘。
- 提示词：

> A single reward video game UI icon for a cozy pastel toyhouse mobile game. Glossy hand-painted kawaii rounded lavender television with a large cream white triangular play symbol, tiny pink bow and one small golden star. Chunky soft outlines, pink and lilac gradients, pearly highlights, friendly toy-like 2.5D rendering. Front view, centered isolated icon occupying 80 percent of square canvas. Pure solid white background for later cutout, no cast shadow outside silhouette, no text, no letters, no watermark. Must remain legible at 40 pixels.

## 验证

当前按钮 v3：官方 Imagegen CLI/API，gpt-image-2/high，原图 `output/imagegen/tool-buttons-v3.png`，导出命令 `scripts/export-tool-buttons-v2.py v3`，裁切记录 `art/tool-buttons-v3.json`。运行素材 `assets/tool-dialog-v1/ui_tool_buy_yellow_v3.png` 与 `ui_tool_ad_pink_v3.png`，均为 508×286；按 254×143 显示，不横向挤压圆角。提示词见 `art/tool-buttons-v3-prompt.txt`。旧版资源保留供追溯。

`tests/verify-tool-ads.mjs` 使用可控广告接口替身，验证源码与 docs 三视口、三个道具成功发奖、取消、无广告、异常、缺失收据、重复收据、防连点、弹窗锁定、存档重载。它是浏览器逻辑验证，不是真实广告验收。
现有 `verify-tool-economy.mjs` 和 `verify-tool-popup2.mjs` 检查原有经济、使用上限和弹窗资源；标准 web_game_playwright_client 检查实际画面与错误。

## 2026-09-28 广告后自动使用验证

已同步本地 Web/docs 与独立 Maker。浏览器9组道具/视口测试及实际 Maker Lua 的前后台、自动洗牌5个、重复/失败回调、次数上限、存档回读通过；Maker 26个UI场景和4500个动作样本通过。广告后台本次复查超时，沿用此前成功确认的配置；未远程构建或真机验收。测试报告：`output/maker-ad-autouse/ad-test-report.json`、`test-output/tool-ads/report.json`。
