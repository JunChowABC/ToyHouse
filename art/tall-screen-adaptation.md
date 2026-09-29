# 长屏适配与验证 · 2026-09-29

## 实现

- Web 容器使用实际动态视口高度。540×960 保留为玩法逻辑坐标；房间背景独立铺满，顶部 HUD 避开安全区，底部道具和首页开始按钮向底部锚定。棋盘与弹窗等比居中，绘制和触摸共用偏移。
- 加载页、首页、玩法、设置、暂停、三种道具弹窗、目标选择、结算、最终页面及转场遮罩覆盖长屏。横竖屏切换与 DPR 变化重新计算布局。
- Maker 独立工程 `D:\AI游戏\晚安，玩具屋-Maker` 的 `scripts/main.lua`、`scripts/View.lua`、`scripts/ScreenLayout.lua` 已同步。背景延伸至胶囊所在区域，交互内容单独避让胶囊；长屏底部预留 24 个系统逻辑像素，加上按钮自身边距。

## 背景

官方 ImageGen CLI/API，`gpt-image-2`，high，三张原背景居中扩图。提示词、源文件、输出尺寸及 SHA256 见 `art/tall-backgrounds-provenance.json`。

- `assets/runtime-ui/tall-home-v1.webp`
- `assets/runtime-ui/tall-play-v1.webp`
- `assets/runtime-ui/tall-loading-v1.webp`

请求 1024×2816；服务实际返回 756×2079，等比归一化为 1024×2816。原背景中心区域重新合成保留，只在接缝处做 32px 混合。没有将按钮、图标或文字合并进新背景。加载页内嵌缩略图同步更新，避免高清图完成前后比例跳变。

## 验证

- `node tests/verify-tall-screens.mjs`：8 组 Web 流程，含 540×960、390×844、393×852、安全区 59/34、360×800、360×960、1024×768、源码与正式构建；真实点击、取消按压、设置开关、道具选择、结算及转场、横竖屏切换。正式构建没有开发控制接口，页面/资源错误为 0。
- 标准 develop-web-game Playwright 客户端已运行并检查首页与玩法截图。
- `tests/verify-maker-tall.py`：先读取本地 Maker 文件到隔离测试目录，再执行真实 Lua Main/View；30 个既有 UI 场景、6 组布局和 DPR/胶囊条件，55 张 UI 渲染回放。检查背景全屏覆盖、按钮边界及真实坐标逆变换。
- `node tests/render-maker-tall.mjs` 将 NanoVG 调用回放到 Canvas；已查看回放截图。该检查不等同于 Maker 引擎或真机运行。
- `npm run build`、`node scripts/verify-release-no-gm.mjs docs` 通过。
- Maker LSP 未通过执行前置条件：本机 wrapper 找不到 `emmylua_check`。未将其记为静态检查通过。

## 交付边界

此 GitHub 发布包基于线上 20 关版本，仅包含长屏适配、三张延展背景和发布排除检查。本地 109 关机制与编辑器未并入。Maker 对应提交 acaa5e3 已远程构建成功，预览刷新 HTTP 200。手机宿主的实际安全区和真机效果仍需验收。GM 仅限本机，未同步到 Maker；docs 与按 Pages 工作流组装的实际上传目录均通过排除检查。

Web 结果：`test-output/tall-screens/report.json`；Maker 结果：`output/tall-screen-maker/tall-validation.json`。同步前 Maker 工作区干净；原 Main/View 备份在 `output/tall-screen-maker/before-sync`，同步采用文件哈希保护，未覆盖其他文件。
