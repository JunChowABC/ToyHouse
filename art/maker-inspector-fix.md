# Maker 预览广告 Inspector 报错修复

报告：2026-09-28 18:23:48.820（引擎报告外层为UTC 10:23:48），`UI Inspector requested but failed to load`。

## 根因与触发链

游戏调用 `sdk:ShowRewardVideoAd` → 无原生广告SDK的预览宿主加载官方 `urhox-libs/FakeAd` → `buildUI`直接引入 `UI/Core/UI` 并调用 `UI.Init` → preview环境默认请求Inspector，但未经过 `UI/init.lua` 的Inspector注册 → UI.lua:555输出报告中的错误。

本地配套Inspector的Panel.lua另有4处弯引号字符串（stretch两处、center、normal），Lua解析失败。直接补充require仍不足以保证可用。

## 修复

- Maker `scripts/main.lua` 在广告SDK调用前执行 `AdPreview.prepare()`。
- `scripts/AdPreview.lua` 仅在preview环境、Inspector尚未注册时引入真实Inspector；已有实例保留，生产环境不引入调试UI。
- `scripts/compat/InspectorPanel.lua` 保留原面板实现，仅替换4处非法字符串引号，通过Lua标准package.preload路由到项目内修正版。不修改本地dev-kit，不伪造Inspector，不屏蔽日志。
- 依赖真正加载失败时仍抛出错误，由已有RewardedAds控制器安全恢复按钮，不发奖。

## 验证边界

- `tests/verify-maker-ad-preview.py` 执行从实际UI.Init截取的原始Inspector分支：修复前复现报告中的错误；注册修复后0错误；重复加载、保留现有Inspector、非preview环境和真实依赖失败不隐藏均通过。
- 9个真实Inspector模块（含修正后的Panel）Lua编译通过；修正版与原版差异严格限定为4处引号。
- `tests/verify-maker-ads.py --installed`：实际main调用、奖励回调、取消/超时/重复请求、存档失败重试和重载通过。
- Maker脚本Lua LSP 0错误。日志：output/maker-ui-sync/lsp-ad-preview/。
- Maker修复提交2ce7df5已推送，远程构建81秒成功，预览刷新HTTP 200。
- 浏览器访问Maker被重定向至未登录介绍页，无法完成在线点击广告的端到端复测；构建和自动回归不等于实机播放验收。
- 本次未推送GitHub，未提交关卡机制模块和相关测试。
