# 关卡机制资源接入 v2

2026-09-29，用户指定资源替换。本任务只更新本地Web及docs构建。

| 用途 | 原始资源 |
|---|---|
| 纸箱 | `原画资源/箱子.png` |
| 冰冻外壳 | `原画资源/冰块.png` |
| 弹簧 | `output/imagegen/mechanics-v2/spring-toy-1x1-overhead-horizontal.png`，俯视、沿棋盘横向平放的 1×1 弹簧；原 `原画资源/弹簧玩具2.png` 保留 |
| 锁盒 / 钥匙 | `原画资源/锁盒.png` / `原画资源/钥匙.png` |
| 传送门 | `原画资源/传送门2.png` |
| 抱抱标识 | `output/imagegen/mechanics-v2/hug-heart-tag.png`，生成的粉色心形挂牌 |
| 睡眠兔子 | `output/imagegen/mechanics-v2/rabbit-sleep.png`，基于当前原画 `原画资源/兔子3-短版.png` 编辑闭眼 |
| 睡眠鲸鱼 | `output/imagegen/mechanics-v2/whale-sleep.png`，基于当前原画 `原画资源/鲸鱼4.png` 编辑闭眼 |
| 睡眠计数底板 | `output/imagegen/mechanics-v2/sleep-count-plate-flat.png`，透明背景、粗棕色描边的扁平粉紫底板，数字由游戏实时绘制 |

生成方式：用户明确授权的 imagegen CLI 备用方式，调用技能自带 `scripts/image_gen.py`，模型 `gpt-image-1.5`，high质量、透明PNG；两张睡眠图为高保真编辑。没有覆盖原始睁眼资源。首批三张图的实际提示词、输入和尺寸保存于 `art/mechanics-imagegen-prompts.json`。计数底板提示词为“单个横向椭圆、粉紫色柔软布面、奶油色缝线与细棕边、中央留白供运行时数字叠加、透明背景、无数字和符号”。

计数底板实际英文提示词：

> Use case: stylized-concept. Asset type: tiny number backing plate on a sleeping rabbit or whale in a pastel bedtime toy puzzle game. Create exactly one isolated compact oval fabric patch, horizontal aspect about 1.3:1, gently padded lavender-pink satin with cream stitched rim and thin warm brown outline, matching soft 2D storybook toy art. Center must be blank and high contrast so game code can draw a dark purple countdown digit on top. Front view, symmetrical, readable at 20 pixels. Transparent background. No letters, numbers, symbols, icons, extra objects, shadow or scene.

2026-09-30 按用户反馈换为粗描边扁平版。旧布纹图保留作为历史来源；运行时改用 `sleep-count-plate-flat.png`。使用已获授权的 imagegen CLI、`gpt-image-1.5`、high、透明 PNG。新图实际主提示词：

> Use case: stylized-concept. Asset type: tiny countdown number backing on the body of a sleeping rabbit or whale in a pastel 2D toy puzzle game. Create exactly one isolated horizontal oval badge, aspect ratio about 1.4:1. Match the supplied toy art visual language: clean flat vector-like illustration, solid soft lavender-pink center, ONE bold continuous warm dark-brown outer outline of uniform thickness, perhaps one simple cream inner accent ring. Broad unobstructed center for a dark purple number drawn separately by game code. Symmetrical front view, crisp simple silhouette readable at 24 by 20 pixels. Fully transparent background. Strictly flat colors with no texture, no fabric, no stitching, no embroidery, no bevel, no satin, no gradient, no highlights, no cast shadow, no 3D effect, no text, no digits, no icon, no extra objects.

运行时导出：`scripts/export-mechanic-art.py`，输出 `assets/mechanics-v1/mechanics.webp`、`rabbit-sleep.webp`、`whale-sleep.webp`。目录名为兼容现有加载入口保留。导出按有效alpha裁边、缩小，并将睡眠图片适配现有玩具的长宽比例，保证唤醒时绘制尺寸稳定。`manifest.json` 记录每张原始图片路径、SHA256及裁切边界；`preview.png` 是资源总览。

冰块图片以两档透明度覆盖玩具，保留冰层数字和最后一层裂纹提示。抱抱双方显示同色心形挂牌，解锁规则沿用原机制。睡眠使用独立闭眼WebP，轻微缩放起伏；三个z字符循环上浮、变大及淡入淡出，使用游戏时间，因此暂停停止，唤醒时立即取消并切回原图。

验收：`node tests/verify-mechanic-art-v2.mjs` 通过。覆盖原始资源哈希和源码/构建图片字节一致、540×960 / 390×844 / 1024×768、真实点击唤醒与解冻及抱抱解锁、暂停呼吸动画、发布包无调试接口、所有相关图片加载无错误。标准游戏客户端两轮预览通过，已查看总览及实际游戏截图。输出位于 `test-output/mechanic-art-v2/`。

独立Maker未同步，未远程发布。本次不更改洗牌图标或玩法规则。

## 朝向与显示尺寸修订

挂牌及钥匙锚点已改到身体：按实际原画绘制尺寸计算，兔子沿背离头部方向偏移长轴的28%，鲸鱼偏移6%，不再使用遮挡脸部的占格中心。

- 心形挂牌及钥匙以朝向上为基准，随玩具上/右/下/左方向旋转0°/90°/180°/−90°，并跟随玩具的呼吸与运动姿态。
- 纸箱、弹簧（含缩回底座）、锁盒、传送门以自身占格中心为轴，显示尺寸统一乘1.2；占格、碰撞、触发和触摸判定不变。
- 旧版紫色数字是配对编号；当前已改为睡眠玩具自身的剩余离场数，见 `docs/design/睡眠离场计数机制-v1.6.md`。

## 1×1 弹簧重绘

2026-09-30 按用户反馈重绘。使用此前已获授权的 imagegen CLI，先生成 `spring-toy-1x1.png`，再以它为输入高保真编辑得到 `spring-toy-1x1-compact.png`。当时版本以粉色底座、宽蓝紫色两圈弹簧和小黄色笑脸构成；因色调与视角不匹配，现已停用。弹簧的占格、碰撞或推移规则没有更改。

当时编辑提示词：

> Edit this spring toy into a COMPACT SQUARE game sprite. Preserve the same thick brown outline and pastel pink, lavender-blue and yellow colors. Make the whole visible toy almost as wide as it is tall, around 1:1 bounding box. Shrink the face to a small cap occupying top 20 percent, shorten the coil to exactly TWO large thick clearly separated S-shaped turns across the middle 55 percent, and widen the pink base across the bottom 25 percent. The blue coil must be the visual focus, at least 70 percent of total width. Make it legible when reduced to 32x32 pixels. Center single toy on transparent background. No elongated vertical body, no thin coil, no extra items, no text.

### 色调与风格修订

用户反馈上述版本比其他玩具和机制道具过于鲜艳、图标化。曾用已授权的 imagegen CLI **仅发送文字提示词**生成 `spring-toy-1x1-style-v2.png`，再运行 `scripts/refine-spring-art.py` 在本地缩小头部、放大线圈和底座，得到现已停用的 `spring-toy-1x1-style-v2-remaster.png`。源原画未上传。曾尝试将本地原画作为风格参考，但外部上传被自动审批拒绝，未执行；后续两次编辑及一次文字生成收到图像服务 502，均没有产生可用图。

实际生成主提示词：

> Use case: stylized-concept. Asset type: transparent one-cell spring toy sprite for a gentle bedtime puzzle game. Create exactly ONE compact nearly square toy, approximately equal visible width and height, centered with modest transparent margin. It must look like the other plush toys and toy mechanisms in the game: warm off-white and butter-yellow little plush animal head, blush pink cheeks, pale powder lavender-blue spring coil, soft cream-pink base, warm medium cocoa-brown rounded outlines. The head is small and soft with delicate toy facial details rather than a big circular emoji smile. The spring is the hero: two or three thick OPEN coils with clear gaps, still readable at 32 by 32 pixels; rounded blush-cream base beneath. Gentle hand-painted 2D storybook illustration, softly blended low-contrast shadows and small cream highlights, plush toy feeling. Pastels should be dusty and low saturation, visually quiet alongside cream rabbits and peach-pink boxes. Avoid vivid cobalt blue, electric purple, neon pink, thick black vector outline, shiny plastic, icon-flat emoji aesthetics, extra objects, text, typography, watermark. Preserve an obvious 1x1 square silhouette and transparent background.

该版棋盘第 76 关截图：`test-output/spring-style-remaster-client/shot-0.png`。

### 俯视角修订（当前运行时）

用户进一步确认玩具和道具以俯视角为主。当前资源 `spring-toy-1x1-overhead-v1.png` 使用已授权 imagegen CLI 的纯文字生成，无本地原画输入：玩具沿对角线平放，镜头约 70° 向下，可见头顶、线圈上表面和尾部。配色仍为奶油白、浅粉、淡蓝紫，线圈在 1×1 格内保持可读。未改变占格和规则。

实际主提示词：

> Use case: stylized-concept. Asset type: transparent 1x1 board-cell sprite for a top-down bedtime toy puzzle game. Draw exactly ONE compact spring toy seen from a HIGH OVERHEAD THREE-QUARTER TOP-DOWN VIEW, camera looking down about 70 degrees. The toy is LYING FLAT ON THE FLOOR, never standing upright. Square visible silhouette, width approximately height, centered and filling the cell. Shape: a tiny cream-and-butter-yellow plush animal head at upper-left, a short chunky lavender-blue COILED SPRING BODY across the middle with three broad open loops visible from above, and a small rounded blush-pink tail/base at lower-right. The top surfaces of the head, spring and base are all visible; no frontal full-face portrait. The spring coils are the largest visual element and readable at 32x32 pixels. Color and finish like polished pastel 2D mobile puzzle toy artwork: quiet cream, soft peach pink, pale powder lavender, small ivory highlights, smooth blended shading, clean warm cocoa-brown outlines of moderate thickness. Soft rounded chibi toy shapes with a few tiny star and heart accents, no texture. Transparent isolated PNG. Strictly avoid eye-level or front view, standing vertical spring, jack-in-the-box, vertical stack, large emoji head, saturated royal blue or neon purple, black outline, watercolor grain, realistic metal, scene, floor, shadow, text, extra objects.

已检查第 76 关实际棋盘截图 `test-output/spring-overhead-client/shot-0.png`；图集来源哈希、三视口美术测试、正式包 GM 排除通过。未同步 Maker 或发布。

### 横向对齐

用户要求弹簧不要斜放。将 `spring-toy-1x1-overhead-v1.png` 在本地逆时针旋转 45°，按透明像素裁边并居中保存为 `spring-toy-1x1-overhead-horizontal.png`，使头部在左、尾部在右、线圈与棋盘行平行。未重新生成图像，也未改变 1×1 占格、碰撞、规则或其他资源。实际第 76 关截图：`test-output/spring-horizontal-client/shot-0.png`。
