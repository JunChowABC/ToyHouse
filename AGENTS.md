# 项目资源语义约定

## 本地 GM 与发布隔离（用户明确要求）

- GM 仅限本机测试。以后“更新/推送/发布到线上”绝不包含 GM 面板、命令、实现文件和测试存档，也不移植到 Maker 线上版。
- GM 实现在被 Git 忽略的 `.local-gm/`；只由绑定回环地址的本地服务器注入源码入口。不要强制添加这些文件，不要将注入代码写入 `src/`、`docs/` 或发布入口。
- 正式构建移除 `window.__toyhouse_debug`；发布前必须运行 `node scripts/verify-release-no-gm.mjs docs` 和对实际发布目录的同等检查。检查失败不得发布；不以隐藏按钮代替排除代码。

- `art/icon-semantics/ui_tool_shuffle.png` 是用户确认的**洗牌图标**。紫色右箭头、粉色左箭头、环形轨迹和星星的外观保持不变，不要把它解释为翻转或反转方向。
- 规范资源 ID：`ui_tool_shuffle`；语义与组件映射见 `art/icon-semantics/ui_tool_shuffle.json`。
- 该图标的分层来源在历史目录 `outputs/flip-popup2-layered-v1/`，PSD 图层组为 `03_SHUFFLE_ICON`。历史目录名和原弹窗标题不能作为该图标用途的依据。
- 用户本次仅要求更正该图标的命名与说明，未要求更改图形、弹窗文字或玩法。修改其他同类资源时，不要自行扩大这个映射范围。
