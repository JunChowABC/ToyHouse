# 道具弹窗资源实装

- 公共框体、顶部装饰、云团光效、说明框和位置以 `outputs/eliminate-popup2-layered-v1/eliminate-popup2-layered-v1.psd` 为准。导出使用该 PSD 已通过位置及像素一致性检查的独立 PNG。
- 消除：原 PSD 的魔法棒组件与华文琥珀描边标题。
- 洗牌：`outputs/flip-popup2-layered-v1` 的 `03_SHUFFLE_ICON` 独立组件，加 `output/imagegen/shuffle-arttext-v1/arttext_shuffle.png`。历史目录名不代表图标语义。
- 翻转：`outputs/flip-tool-icon-v1/ui_tool_flip.png` 黄粉环形箭头，加原已生成的 `arttext_flip.png`。
- 无库存：黄色购买底板、金币及动态价格；有库存：粉色使用底板。不可用时灰度禁用，保留原有金币不足提示隐藏规则。
- 原库存、扣币、选择目标、取消、次数上限、道具说明和持久化逻辑保持不变。

资源生成：`scripts/export-tool-dialog-art.py` → `assets/tool-popup2-v1/`、`src/tool-art-manifest.js`。
构建：`scripts/build-runtime-art.py` → `npm run build`，同步 `docs/` 本地发布包。
验证：标准 Web Game 客户端、`verify-tool-popup2.mjs`（18种工具/状态/视口组合、资源坐标、点击取消）、`verify-tool-economy.mjs`、`verify-runtime-atlas.mjs` 均通过。截图和报告在 `test-output/tool-popup2/`。

仅完成当前 Web 项目和本地构建，未推送或远程发布，未修改独立 Maker 工程。
