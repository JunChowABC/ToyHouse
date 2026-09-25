# 关卡完成弹窗2实装

来源：`outputs/level-complete-popup2-layered-v1/level-complete-popup2-layered-v1.psd`。

2026-09-25 图标统一：通关奖励金币与钻石改为顶部货币栏 `assets/core-ui-v4/coin_icon.png`、`gem_icon.png` 的同一源图，导出文件字节一致。按原奖励图标区域等比缩放并保留中心，导出脚本记录来源；更新货币栏资源后重新导出即可同步。

- 运行资源：`assets/level-complete-popup2-v1/`，43个独立PNG与2个从PSD可编辑标题层导出的美术字PNG，共45个。43个PNG逐一核对PSD图层像素与位置；导出清单保存SHA-256。原PSD保持可编辑。
- 庆祝插画使用 `art_celebration.png`，整体显示；其他底板、奖励卡、数量条、图标、装饰按原941×1672坐标映射到540×960画布。
- “关卡完成”“获得奖励”使用独立美术字贴图，跨设备不依赖本机字体。按钮文字与奖励数量动态绘制；空奖励时标题显示“本关已完成”，最终关卡按钮显示“晚安”。
- 奖励沿用实际结算：普通通关30金币。单奖励时卡片、数量条、图标和数字整体居中；两个奖励按194原图像素间距排列；无效/零数量不占位。不会把参考图中的×100、×3写入结算。
- 返回首页和下一关命中区域随新按钮定位；下一关按钮的箭头、星星和闪光随底板一起按压，移出取消。原有重复点击保护和导航流程保留。
- 运行图集仍为无损WebP，构建脚本逐像素校验裁回的图集资源。`docs/`已同步本地构建；全系统10张运行图片，首页5张，没有独立PNG网络请求。

## 重建

1. `python scripts/export-complete-lettering.py`（需要Pillow、psd-tools和上述本地PSD交付目录）
2. `node scripts/export-complete-art.mjs`
3. `python scripts/build-runtime-art.py`
4. `node scripts/build-web.mjs`

## 验证

- 标准 `web_game_playwright_client.js`：进入关卡、QA清空、等待退场与通关弹窗；截图及文本状态位于 `test-output/complete-dialog/standard/`。
- `node tests/verify-complete-dialog.mjs`：源码540×960、docs手机390×844/DPR2、docs横屏1024×768；逐项资源位置、标题美术字、单/双/空奖励布局、按压同步与移出取消、实际结算、存档、返回/下一关/最终关卡、连续点击防穿透。
- `node tests/verify-runtime-atlas.mjs`：源码与docs图片加载，无页面/资源错误。
- 图片和原始PNG/构建PNG一致性通过；已查看标准客户端、桌面、手机及横屏截图。

本次是当前Web工程与docs本地构建，尚未远程发布。
