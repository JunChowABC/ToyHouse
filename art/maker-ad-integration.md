# Maker 道具激励广告接入

## 实际修改

工程：`D:/AI游戏/晚安，玩具屋-Maker`，app_id `941354`，developer_id `429598`。

- `.project/settings.json`：用户授权后新增已验证的本项目 `@runtime.ad`，status=1；未改动引擎版本、构建路径或单机配置。
- `scripts/RewardedAds.lua`：单次请求控制器，只有 SDK 回调的严格布尔 `success=true` 才增加所选道具1个并调用现有保存接口。SDK返回值仅作请求受理判定。一次性完成标记防重复回调；取消、错误、拒绝、超时均不发奖。
- `scripts/main.lua`：看广告按钮调用 `sdk:ShowRewardVideoAd`；更新超时、停止时取消回调处理、广告失焦保留弹窗、观看期间锁定键盘和点击操作。
- `scripts/Game.lua`：广告状态初始化、打开弹窗清除旧提示、播放期间禁止购买使用。
- `scripts/View.lua`：黄色购买/使用与粉色广告按钮同行；新图标、禁用状态、观看和奖励提示、对应点击区域。
- `assets/toyhouse-ui-v2/ads/`：5张PNG，保留已确认的两张按钮和粗描边图标原始字节，另导出两张灰色禁用底图。

完整观看并关闭广告、回到游戏前台后，弹窗收起并立即使用当前道具：洗牌自动使最多5个可用玩具转向，扣除1个库存并计本关1次使用；消除/翻转直接进入目标选择，选择有效目标后消耗。广告不扣金币；本关3次使用限制保持，达到上限禁用广告入口。使用原有Save.lua整数云存档，保存失败按现有流程保留当前内存和重试提示。临时试玩模式仍不保存。

## 核验结果

- 配置与同项目 get_ad_config 返回一致。工具的远端路径未当作本地同步证据；实际写入后回读核对。
- `tests/verify-maker-ads.py --installed`：3个道具的同步/异步成功、返回false且有/无回调、异常、取消、非布尔成功、重复回调、180秒更新超时、过期回调、停止后回调、使用上限及存档标记；真实main.lua的点击、失焦、Escape和数字快捷键锁定通过。
- 同一测试执行实际Save.lua：奖励编码写入失败、重试、重复回调、重新加载恢复库存通过。云传输使用替身，没有向真实账号写测试数据。
- `tests/verify-maker-ui.py output/maker-ad-integration`：26个UI场景通过，检查资源存在、点击区域、禁用状态、绘制不修改存档。显示截图来自真实Lua绘制指令Canvas回放，位于 `output/playwright/maker-ads/`。
- `tests/verify-maker-toy-motion.py`：4500个JS/Lua动作样本及移动/暂停/退出时序通过。
- 本地 maker-lua-lsp 使用已有 emmylua_ls 的watch模式完成诊断：0错误、123警告；日志 `output/maker-ad-integration/lsp/`。未将首次check模式缺少emmylua_check误记为通过。
- 安装的4份Lua脚本、5份PNG与已测副本逐字节一致，Maker git diff --check通过。

## 尚未验证

已随Maker提交166dd51推送，远程构建成功、预览刷新200。真实播放必须在支持广告的TapTap手机宿主环境验证：完整观看发放1个；提前关闭不发；无广告/网络失败恢复按钮；连点不重复请求；成功后重进库存正确。Web/PC预览不代表支持真实广告。

## 2026-09-28 广告后自动使用验证

已同步本地 Web/docs 与独立 Maker。浏览器9组道具/视口测试及实际 Maker Lua 的前后台、自动洗牌5个、重复/失败回调、次数上限、存档回读通过；Maker 26个UI场景和4500个动作样本通过。广告后台本次复查超时，沿用此前成功确认的配置；未远程构建或真机验收。测试报告：`output/maker-ad-autouse/ad-test-report.json`、`test-output/tool-ads/report.json`。
