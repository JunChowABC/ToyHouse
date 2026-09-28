# 2026-09-28 最新改动双端同步

Maker提交：`166dd51`，远程构建41秒成功，预览刷新HTTP 200。此结果同时覆盖上轮未能确认的Loading发布内容。

- GitHub包含当前Web源码、docs运行包、新增原画、设计文档、广告资源和同步脚本。沿用临时目录tmp和既有忽略项的排除规则。
- Web：广告双按钮与严格完成奖励、新Combo进度条和动态数字布局、Loading顶部Logo与内置轻量首帧、弹窗开合及下一关转场。
- Maker：保留已接入的广告SDK和同项目广告配置；同步Combo、数字布局、Loading Logo、弹窗开合和下一关圆形遮罩转场。新增UiMotion.lua，播放动画期间锁定输入并冻结关卡推进。
- 制造首帧采用本地引擎文档支持的专用loading_screen预下载组，仅预下载Loading资源；首页、玩法和弹窗仍按组下载。Web使用内置轻量图再升级高清，两端启动实现不同。
- 制造迁移脚本：scripts/patch-maker-presentation.py；资源导出：scripts/export-maker-ui.mjs、scripts/export-maker-ui.py。不会覆盖RewardedAds.lua或广告配置。

## 验证

- npm run build通过，14张运行图片请求检查通过（含3张已声明广告PNG）。
- Web核心UI及Combo三视口、Loading三视口/外部图阻断冷启动、9组广告流程、4组动效/减少动态效果场景通过。标准Playwright客户端与截图检查通过。
- 制造24组常规UI和4组Loading绘制检查、真实奖励控制器和main输入锁定、Save.lua失败重试/重载、弹窗延迟关闭/下一关/最终关时序、4500组动作对照、Loading异步取消重试通过。
- Lua LSP 0错误；制造截图为真实Lua指令的Canvas回放，不是引擎或手机截图。
- 真实广告观看、提前关闭和手机触摸仍需TapTap手机宿主验收。GitHub网页没有广告宿主时显示无可用广告提示，不模拟发奖。
