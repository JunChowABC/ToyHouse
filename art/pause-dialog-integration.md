# 暂停弹窗效果图2 · 美术字版实装

采用 `outputs/pause-popup2-layered-v2-arttext/` 中的分层资源。保留源 PSD 941×1672 坐标，在游戏 540×960 逻辑画布上等比映射，未用完整弹窗截图替代独立资源。

- `scripts/export-pause-art.mjs` 导出46张独立PNG至 `assets/pause-popup2-v2/`，保留坐标与SHA256，字节与交付资源一致。
- `src/pause-dialog.js` 绘制46个资源实例；暂停、重新开始、继续游戏、退出关卡为独立美术字，背景音乐、游戏音效、震动反馈按PSD规格实时绘字。
- 运行时仍通过无损WebP图集加载；源码及docs构建均为9次图片请求，首页5次，没有独立PNG网络请求。
- 首页设置和道具弹窗使用 `src/shared-dialog-art-manifest.js` 保留其共用的既有装饰和动态标题；新版替换局内暂停弹窗。
- 继续、重新开始、返回首页沿用原有游戏逻辑；点击热区与新版位置一致。弹窗拦截棋盘点击和道具快捷键，原暂停冻结逻辑保留。
- 三个设置均可切换样式，音乐和音效初始开启，震动初始关闭。设置存于独立的 `toyhouse-settings-v1`，不修改金币/道具存档。
- 音效控制现有合成音效；震动控制浏览器 `navigator.vibrate`，在支持该 API 的设备上响应游戏反馈，并独立于音效开关。实际设备震感未做真机验收。
- 当前项目没有 BGM 音轨/播放系统；音乐项持久化开关状态，接入音乐素材后才能控制实际背景音乐。
- 开启态为粉色底槽、右侧白色滑块与粉星；关闭态复用紫色底槽、左侧滑块与紫星。底槽、滑块和星形保持独立，三行整行可点。

## 验证

`tests/verify-pause-art.mjs` 覆盖源码桌面540×960、本地docs手机390×844 DPR2、横屏1024×768：检查46次独立资源绘制及原位坐标、四项美术字、六项控件按下缩放与移出取消、开关状态和刷新保存、Esc/P、继续、退出及重开。通过替代浏览器震动API检查开启/关闭及静音独立性。截图及报告位于 `test-output/pause-art/`。

`tests/verify-pause-menu.mjs` 检查Combo暂停冻结/继续恢复及重开；`tests/verify-tool-economy.mjs` 检查共用道具弹窗功能；`tests/verify-runtime-atlas.mjs` 检查图集网络请求。标准web-game客户端截图位于 `test-output/pause-popup2/standard/`。

`npm run build` 同步本地 `docs/` 发布目录，不推送或部署线上。
