# Loading 分层资源实装

来源：`outputs/loading-layered-v1/loading-layered-v1.psd`。25 个图片资源包含完整卧室背景和24个独立UI；Loading...保留美术字，中文提示由程序绘制。

`scripts/export-loading-art.py` 核对交付 PSD、PNG 的 SHA-256，导出完整背景和独立UI图集（共2张无损WebP，约1.92 MB），逐切片验证无损。原始PNG和PSD留在交付目录。`src/loading-art-manifest.js` 保留原图941×1672坐标、绘制顺序和来源哈希，运行画布540×960等比映射。

`src/loading-screen.js` 分层绘制背景、云朵外底板和区域、兔子/云朵/月亮/星星/闪光、进度条外框、空槽、动态填充、星形标记、Loading美术字。进度填充保留原斜纹尺度，超过源图参考进度时向右延展，并按空槽形状及当前进度裁切；星标跟随填充末端。

首次启动的进度来自首页与货币资源的实际完成数，资源就绪后展示满进度再进入首页（首屏最短650ms，成功满进度至少180ms）。后续玩法/设置/通关仍走原有分段加载，等待时共用该界面；不会在资源缺失时进入玩法。等待中可返回或Escape取消，旧请求完成后不会跳转。失败保留重试；加载界面高清图片尚未就绪或失败时，使用随程序内置的轻量背景和UI图集显示同一新版界面；高清图到达后自动替换，不阻塞已就绪首页。

构建脚本已加入加载模块和两张运行图片，源码入口与 `docs/` 本地包同步。游戏关卡、经济与存档规则不变。

验证：
- `tests/verify-loading-screen.mjs`：源码桌面、docs手机竖屏/横屏；首屏真实进度、等待、点击返回、重新进入、次级资源失败重试、加载美术失败兜底。
- `tests/verify-staged-loading.mjs`：所有次级资源阻塞时首页仍可用，开始/取消/再次开始/后台完成。
- `tests/verify-image-loading.mjs`：请求超时自动重试、首页加载失败手动恢复。
- `tests/verify-runtime-atlas.mjs`：现有9张运行图加2张加载图，共11张，未发出独立PNG请求。
- 标准web_game_playwright_client已运行并检查局内截图；0%/60%/100%填充像素与截图检查通过。

截图与报告：`test-output/loading-screen/`。

2026-09-28 双端同步：独立 Maker 项目已接入同源分层资源、真实下载进度、首屏650ms/满进度180ms等待、取消/重入/失败重试和装饰失败兜底。Lua 模块保留于 `scripts/maker/Loading.lua`；`tests/verify-maker-loading.py` 验证异步完成顺序和失败分支。Maker 的满幅进度斜纹预先按槽位圆角裁切，运行时随真实进度裁切并移动星标。远程发布结果见 `progress.md`。


## 顶部Logo增补
复用登录界面交付的 `outputs/login-screen-layered-v1/layers/art_logo_goodnight_toyhouse.png`；保持原比例、顶部66px、水平居中。导出器记录来源哈希，加入高清/内置轻量图集。当前总26项独立资源，外部请求仍2张WebP，总约2.17MB。顶部Logo在外部图片未到达时同样显示。三视口与冷启动验证通过。
