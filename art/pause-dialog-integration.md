# 暂停弹窗 v2 实装

采用 `outputs/20260918_pause_psd_v2_vibration_off/` 中的分层资源。保留源 PSD 941×1672 坐标，在游戏 540×960 逻辑画布上等比映射，未用完整弹窗截图替代独立资源。

- `scripts/export-pause-art.mjs` 导出 49 张当前资源及震动开启态底座，共 50 张 PNG，存入 `assets/pause-dialog-v2/`；保留坐标与 SHA256。
- `src/pause-dialog.js` 绘制 49 个资源实例及运行时文字。文字根据 PSD 字体规格绘制，系统没有源字体时采用宋体/圆体回退；未打包或分发系统字体文件。
- 继续、重新开始、返回首页沿用原有游戏逻辑；点击热区与新版位置一致。弹窗拦截棋盘点击和道具快捷键，原暂停冻结逻辑保留。
- 三个设置均可切换样式，音乐和音效初始开启，震动初始关闭。设置存于独立的 `toyhouse-settings-v1`，不修改金币/道具存档。
- 音效控制现有合成音效；震动控制浏览器 `navigator.vibrate`，在支持该 API 的设备上响应游戏反馈，并独立于音效开关。实际设备震感未做真机验收。
- 当前项目没有 BGM 音轨/播放系统；音乐项持久化开关状态，接入音乐素材后才能控制实际背景音乐。
- 关闭态复用已由 ImageGen 生成的灰紫底座，三个开关都保持独立底座、白色滑块和运行时“开/关”字。

## 验证

`tests/verify-pause-art.mjs` 覆盖源码桌面 540×960、发布版手机 390×844 DPR2、横屏 1024×768，检查实际 49 次资源绘制、开关状态、可点击位置、刷新保存、Esc/P、返回首页及重开。通过替代浏览器震动 API 检查开启/关闭及静音独立性。

`tests/verify-pause-menu.mjs` 检查 Combo 暂停冻结/继续恢复及重开；`tests/verify-impact-combo.mjs` 检查撞击与 Combo 回归。标准 web-game 客户端截图位于 `test-output/pause-standard/`。

`npm run build` 同步本地 `docs/` 发布目录，不推送或部署线上。
