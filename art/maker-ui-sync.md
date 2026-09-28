# 新版 UI 同步至 TapTap 制造（2026-09-25）

- Web 基准：GitHub `b8badc5`；Maker 提交：`ddd5a19`。
- Maker 工程：`D:\AI游戏\晚安，玩具屋-Maker`。
- 同步范围：核心 HUD（返回、货币、关卡标题、动态 Combo、道具按钮与库存）、暂停开关及三个操作按钮、三种道具说明/购买/使用/禁用状态、通关奖励及导航。
- 使用现有网页资源的运行像素；192 项源资源和禁用按钮灰度副本。消除标题按网页 STHupo 字体烘焙，洗牌保留紫右箭头、粉左箭头、轨迹及星星；不扩展该语义到其他图标。
- Maker 修改：`scripts/View.lua`、新增 `scripts/UiData.lua`、`assets/toyhouse-ui-v2/`。原 `Game.lua`、`Save.lua`、关卡、背景和玩具动作规则未修改。
- 导出：`node scripts/export-maker-ui.mjs`，再使用已安装 Pillow 的 Python 运行 `scripts/export-maker-ui.py`。导出仅写本地 staging，不会自动覆盖 Maker。
- 资源来源与 SHA256：`output/maker-ui-sync/asset-provenance.json`；旧 View 备份：`output/maker-ui-sync/View.before.lua`。
- 验证：20 组 Lua 绘制场景、资源存在与哈希、所有热区中心点击、禁用状态、矩阵栈平衡及绘制不修改存档通过；4500 组 JS/Lua 动作及碰撞/暂停/离场回归通过。
- Lua LSP：0 错误、103 警告。check 模式缺少 emmylua_check，使用现有 EmmyLuaLS watch 模式完成检查。报告：`output/maker-ui-sync/lsp/`。
- 画面检查：`output/playwright/maker-ui/` 为真实 Lua 绘制指令的 Canvas 回放，字体使用浏览器近似，不是引擎实机截图。
- Maker：远程构建 38 秒成功，preview-refresh HTTP 200；日志 watcher 无失败。回传运行日志早于本次构建，不能作为新版手机运行验收。
- 本地 Runtime 未安装、预览未运行；没有启动或安装本地 Runtime。浏览器连接工具因 Codex auth token unavailable 无法读取远程预览页面。
- 尚未完成：新版手机实机视觉与触摸验收。
