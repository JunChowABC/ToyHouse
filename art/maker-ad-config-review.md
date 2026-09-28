# Maker 广告本地配置待同步

**更新：用户已明确允许同步。配置已写入并回读核验，广告代码接入与本地检查已完成，见 `art/maker-ad-integration.md`。以下保留同步前的审阅记录。**

2026-09-28 实时查询：目标工程 `D:/AI游戏/晚安，玩具屋-Maker` 已绑定且主配置存在，工作区干净。`get_ad_config` 返回 app_id `941354`、developer_id `429598`，`ad.status=1`，广告变现已生效。

远端配置文件是 `/userspaces/88134f12-7b34-4525-be62-9c2e71223a0a/workspace/.project/settings.json`，不代表本机文件已更新。本机 `.project/settings.json` 当前 `@runtime` 只有 `multiplayer.enabled=false`，没有 `ad`。

已准备配置副本：`output/maker-ad-config/settings.candidate.json`。唯一语义变更是新增 `@runtime.ad`，值严格来自本项目本次工具返回：

```json
{
  "status": 1,
  "ad_spaces": [
    { "id": "1054323", "type": 1 },
    { "id": "1054324", "type": 2 }
  ],
  "top_on_placements": [],
  "synced_at": "2026-09-28T09:46:14.166Z"
}
```

Maker 广告指南原文：
> If absent, different or unverifiable, pause ad implementation/testing and report "remote configuration obtained; local synchronization not verified" with the missing evidence.
> Do not copy another project's configuration, guess fields, overwrite settings, or pull/build to resolve this automatically.

因此本次未修改 Maker 配置或广告代码，未拉取、构建、提交或发布。待明确同步这项新增配置并回读核验后，接入项目文档规定的 `sdk:ShowRewardVideoAd`。

已核实 SDK：方法返回 true 只表示请求受理，最终仅回调 `result.success == true` 才发放当前道具 1 个。返回 false 可能同步触发失败回调，也可能完全无回调；接入时必须同时处理返回值与回调，以一次性完成状态避免重复发奖。需要连同 Web 已确认的双按钮和简化粗描边图标同步至独立 Maker，并保留保存、次数限制和失败恢复行为。真机验证独立于本地 Lua 检查。
