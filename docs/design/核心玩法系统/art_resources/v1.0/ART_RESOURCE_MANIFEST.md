# 核心玩法系统原画资源包 v1.0

## 交付状态

- 生成方式：Codex 内置 `image_gen`；参考《花花与幕间剧》公开画面与项目内核心玩法界面稿的色彩/构图要求。
- 资源成熟度：AI 辅助高保真原画评审稿 / 生产前置稿，不等同于最终上线资源。
- 透明度 QA：拆件类与玩具设定板已复核为 RGBA；场景与动作指南为整幅 RGB 评审稿，按 ADD 约定不作为运行时透明切片。
- 未交付内容：分层 PSB/PSD、逐方向独立运行时 PNG、骨骼动画、最终 FX、Godot 导入参数与图集切片表，需由原画/TA/程序继续制作。

## 资源索引

| ADD ID | 文件 | 内容与用途 |
| --- | --- | --- |
| ART-SCN-001 | `scene/art_scn_001_coreplay_room_empty.png` | 无玩具空场整景，验证 HUD 安全区、盘面位置与四边出口 |
| ART-SCN-001 | `scene/art_scn_001_coreplay_room_readability.png` | 仅含兔子/小鸭/鲸鱼的高密度可读性验证 |
| ART-SCN-001 | `../assets/核心玩法效果图-v6-动物餐厅手绘风-重制.png` | 动物餐厅手绘风格对比稿；用于风格评审，不作为运行时场景层 |
| ART-SCN-002 | `scene/bg_coreplay_00_back-v2-flat.png` | 推荐：平面粉彩卧室远景层；旧版 `bg_coreplay_00_back.png` 保留作对照 |
| ART-SCN-002 | `scene/bg_coreplay_00_back-v3-dim-warm.png` | 暗夜暖光备选：床头灯局部暖光、中心盘面安全区保持清晰 |
| ART-SCN-003 | `scene/bg_coreplay_01_mid-v2-flat.png` | 推荐：平面粉彩地面/底部软垫中景层；旧版 `bg_coreplay_01_mid.png` 保留作对照 |
| ART-SCN-004 | `board/prop_board_coreplay_base.png` | 四边缺口盘面主底，RGBA |
| ART-SCN-005 | `board/art_scn_005_board_edge_modules.png` | 围边直线与圆角模块板，RGBA |
| ART-SCN-006 | `board/art_scn_006_board_exit_modules.png` | 上/下/左/右缺口模块板，RGBA |
| ART-SCN-007 | `board/art_scn_007_toy_shadow_templates.png` | 1×1、1×2、1×3 接地软阴影模板，RGBA |
| ART-SCN-008 | `guides/art_scn_008_playable_area_guide.png` | 可玩区/非可玩区无 UI 分区验收稿 |
| ART-TOY-001 | `toys/art_toy_001_rabbit_design_sheet.png` | 兔子设定板：四方向、待机、碰撞、打哈欠、离场姿态，RGBA |
| ART-TOY-002 | `toys/art_toy_002_duck_design_sheet.png` | 小鸭设定板：四方向、待机、转弯、启动、离场姿态，RGBA |
| ART-TOY-003 | `toys/art_toy_003_whale_design_sheet.png` | 鲸鱼设定板：四方向、待机、碰撞、打哈欠、离场姿态，RGBA |
| ART-TOY-004 | `guides/art_toy_004_footprint_template.png` | 三类玩具 1×1 / 1×2 / 1×3 占格与安全轮廓模板 |
| ART-TOY-005 | `guides/art_toy_005_collision_pose_guide.png` | 三类玩具接触/最大压缩/恢复关键姿态参考 |
| ART-TOY-006 | `guides/art_toy_006_hint_yawn_pose_guide.png` | 兔子、鲸鱼起始/最大/恢复打哈欠姿态参考 |
| ART-DEC-001 | `decor/art_dec_001_bed_pillow.png` | 床沿与星月枕角拆件，RGBA |
| ART-DEC-002 | `decor/art_dec_002_shelf_storage.png` | 收纳架与盒子拆件，RGBA |
| ART-DEC-003 | `decor/art_dec_003_books_cushion.png` | 睡前书本与软垫拆件，RGBA |
| ART-DEC-004 | `decor/art_dec_004_curtain_star_moon.png` | 星月窗帘、帷幔、布艺挂饰拆件，RGBA |
| ART-DEC-005 | `decor/art_dec_005_bedside_lamp.png` | 床头暖光灯体与独立光斑概念拆件，RGBA |

## 使用边界

1. 玩法只使用三类功能玩具：兔子 1×2、小鸭 1×1、大鲸鱼 1×3；本包没有生成玩具熊等额外功能类别。
2. 设定板中的多姿态是原画/动画参考，不可直接当作最终运行时序列；需按统一锚点和碰撞轮廓切图。
3. 撞击姿态只描述同步形变接口；星星、闪光、路径粒子和 Combo 反馈仍归 UI/FX/动作系统。
4. 场景图不烘焙 HUD；最终运行时应保持远景、中景、盘面、围边、缺口、前景可独立控制。
