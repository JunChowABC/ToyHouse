# toyhouse-gameplay-layered-v5.psd 资源接入说明

2026-09-07。本次交付为已接入并通过浏览器验证的本地可运行版本；`docs/` 发布包已同步，未推送或部署线上。

## 来源与导出

- 唯一美术来源：`outputs/layered_psd_v5/toyhouse-gameplay-layered-v5.psd`，原文件不修改。
- 画布为 941×1672，游戏逻辑画布为 540×960，显示支持最高 2 倍设备像素比。
- 实际 PSD 在最终保存时调整过按钮、图标、挂饰等位置，因此以 PSD 图层边界为准，未沿用旧 JSON 中对应位置。
- 运行 `python scripts/export-psd-assets.py` 导出 49 张独立 RGBA PNG。脚本使用现有 psd-tools/Pillow 依赖；逐层 composite 应用 PSD 用户蒙版，避免 topil 原始像素产生黑底。导出后逐张重新打开，校验像素、尺寸与透明通道。
- `assets/toyhouse-v5/manifest.json` 记录 PSD 哈希、图层边界、角色、每张 PNG 的 SHA-256 和排除层。`src/art-manifest.js` 是生成的运行时索引。
- 全部普通文字由 Canvas 动态绘制，字体优先 SimHei，其次微软雅黑/苹方。字体不随包分发，缺少黑体的平台使用系统回退。

## 图层装配与状态

| 资源组 | 用途与布局 | 状态与约束 |
| --- | --- | --- |
| art_bedroom_bg / fx_room_sparkles | 画布底层，铺满 540×960 | 不显示隐藏参考图 |
| ui_playmat_base | 地毯完整等比绘制于 x0/y218/w540/h552.73，保留原始圆形，不做九宫格 | 棋盘 x114/y260、12×18、26 像素格子；只缩放显示，不改变任何关卡占格；兔子距占格边缘仅留 0.5 像素，相比 24 像素格子版本放大约 25% |
| toy_rabbit_white_a | 1×2 普通兔子，使用坐姿源素材，位于自身占格中心 | UP 0°、RIGHT 90°、DOWN 180°、LEFT -90°；耳朵指向移动方向；不显示外框和箭头 |
| toy_duck_yellow_a | 1×1 自动离场小鸭 | 无固定方向标志，沿自动寻路轨迹移动 |
| toy_whale_blue_a | 1×3 鲸鱼 | 按方向旋转或镜像，沿现有直线路径移动 |
| toy_bear_brown_a | 首页和最终演出装饰 | 不添加到关卡玩具配置 |
| top_hud / avatar / profile_hanging_stars | 按 PSD 位置缩放装配在棋盘之上 | 暖棕色、奶油描边标题位于 x284/y65，单行“第01关·月光敲敲窗”，不显示第二行；20 关名称取自 art/level-titles.json |
| resource_bar / star / coin / add_button | 右上两行资源展示 | 金币显示本地实际余额；星星显示横线、加号置灰；金币初始暂为0 |
| combo_panel / combo_bar_fill | 顶部连击区，填充素材加载后用 source-in 统一着色为 #f38faa，保留透明轮廓与独立边框，再按 8 秒计时横向裁切 | 取消原素材粉/金两段颜色；真实 Combo 数，归零时空条；暂停冻结；不再显示待归位数 |
| pause_button | 右上，热区 x461/y119/w57/h48 | 打开已有暂停菜单；标题及操作按钮复用 v5 板材，开关保持原功能 |
| bottom_toolbar / button_disc / icons / small_badge | 底部先总底板、再圆盘、图标、角标、文字 | 角标为库存，初始0；点击进入说明弹窗；每道具每关最多3次，缺货可花100金币购买并使用；无底部额外小字 |

局内层序：背景 → 地毯 → 玩具/轮廓发光/运动与撞击效果 → HUD → 工具栏 → 暂停或结算遮罩。所有局内飘字与临时文字提示均已删除；固定 Combo 与操作选中反馈保留。离场对象从 HUD 背后经过。玩具点击仍按原始网格计算，不按透明像素计算。

原有 `toy_rabbit_lie_*` 侧躺造型实例仍全部排除；按照后续反馈，坐姿白兔源素材现在可以旋转以表达前进方向。隐藏粉/紫/绿皮肤与参考图不进入运行包。其它重复站姿实例不重复加载。装饰星星保留为可用独立资源，部分用于首页。

## 构建与验证

```powershell
npm install
npm start
# 另一终端
npm run build
npm run test:levels
node tests/verify-v5-art.mjs
node tests/verify-impact-combo.mjs
node tests/verify-pause-menu.mjs
```

发布构建会复制 PNG、manifest、CSS、入口 HTML 并生成混淆脚本，支持 GitHub Pages 项目子路径；运行时不依赖 outputs/、PSD、Python 或 node_modules/。

已检查：首页、第一关、含兔/鸭/鲸鱼的第 16 关、消除首目标、暂停弹窗、Combo；覆盖 540×960、390×844（DPR 2）、1024×768。源码和发布版分别连续清空 20 关，逐只对照原配置共 1,440 个玩具，移动/自动连锁/撞击/暂停规则保持有效。各截图与机读报告位于 `test-output/v5-art/`、`test-output/levels-v13/`。
