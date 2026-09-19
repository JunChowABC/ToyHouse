# 核心玩法系统效果图 v11 生成记录

- 生成模式：内置 ImageGen，`precise-object-edit`
- 编辑底图：`核心玩法系统效果图-v10-第一关-Combo-彩色道具-1080x1920.png`
- 风格参考：用户提供的《花花与幕间剧》界面截图
- 输出目标：降低 UI 立体感；底部三个操作按钮改为同色正方形

## 第一轮：整体 UI 扁平化

```text
Use case: precise-object-edit
Asset type: high-fidelity portrait mobile game core-play screenshot, UI flattening revision

Image 1 is the EDIT TARGET. Preserve its scene, background decorations, rabbits, layout and gameplay state.
Image 2 is STYLE REFERENCE ONLY. Match its very light, flat, soft pastel 2D mobile-game UI treatment: thin outlines, low contrast material rendering, almost no depth, no embossed widgets, no thick toy-like bevels. Do not copy its scene, characters, icons, text or layout.

Flatten the entire UI of Image 1 so it is much closer to the visual lightness of Image 2. Remove thick layered borders, heavy stitching, inflated padding, bevels, glossy highlights, extrusion, inner shadows and cast shadows. Use thin warm-pink outlines, soft cream surfaces and nearly flat silhouettes.

Replace the three bottom buttons with exactly three equal-size square buttons in one row. All three use one identical soft blush-pink color. Preserve the texts “消除 / 选2只”, “洗牌 / 随机5只”, and “翻转 / 选1只”. Keep the non-rabbit clear icon, shuffle arrows and flip arrow.

Keep “连击 ×6” inside a slim progress bar with no seconds. Preserve exactly 72 rabbits and all first-level positions, directions and spacing. No board, other toys, extra controls or watermark.
```

## 第二轮：正方形按钮定向修正（最终提示词）

```text
Use case: precise-object-edit
Asset type: portrait mobile game UI mockup, bottom-button geometry correction

Image 1 is the EDIT TARGET. Image 2 remains STYLE REFERENCE ONLY for flat, delicate pastel 2D UI.

Make exactly one targeted correction: redesign ONLY the three bottom tool buttons. Preserve every other pixel-level design choice from Image 1, including the flattened top UI, Combo bar, pause button, scalloped bottom strip, background, all decorations, exact text outside the buttons, and the exact 72-rabbit arrangement.

BOTTOM BUTTON CORRECTION
- Change the current tall buttons into three TRUE SQUARE buttons: visible outer width equals visible outer height, 1:1 aspect ratio.
- Keep exactly three identical-size squares in one centered horizontal row with equal gaps.
- All three squares use the SAME clearly visible soft blush-pink fill, approximately #F3B6C0.
- Use only one thin muted-rose outer line and an optional very thin cream inner line. Almost no shadow, no bevel, no raised rim, no padded/plush thickness, no glossy gradient.
- Use a compact vertical content layout: icon on top, main label below, secondary label at bottom.
- Preserve exact Chinese text: “消除 / 选2只”, “洗牌 / 随机5只”, “翻转 / 选1只”.
- Preserve the non-rabbit clear icon, shuffle arrows and circular flip arrow.

Do not change “连击 ×6”, “第一夜 · 1-1”, or any rabbit. Keep exactly 72 rabbits. No board, grid, other toys, popup, watermark or extra controls.
```
