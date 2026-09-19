# 核心玩法系统效果图 v10 生成记录

- 生成模式：内置 ImageGen，precise-object-edit
- 编辑底图：`核心玩法系统效果图-v9-第一关-无棋盘-精确朝向-1080x1920.png`
- 输出目标：第一关核心玩法界面，强化道具按钮辨识度并展示 Combo 状态

## 最终提示词

```text
Use case: precise-object-edit
Asset type: high-fidelity first-level mobile game core-play screenshot, active Combo state

Image 1 is the EDIT TARGET. Make ONLY the following UI changes. Preserve the full stitched pastel background, all decorations, the no-board layout, the top-left level label “第一夜 · 1-1”, the enabled top-right pause button, and the exact 72-rabbit first-level arrangement, positions, directions, scale, spacing and appearance. Do not move, remove, add, redraw or change any rabbit.

CHANGE 1 — MAKE THE THREE BOTTOM TOOL BUTTONS CLEARER
Keep exactly three equal-size buttons in the same positions and preserve all existing Chinese text:
- Left “消除” with secondary text “选2只”: change its button fill to a clear soft coral/blush pink (#F39AAA range), with a darker rose outline and deep warm-brown text.
- Center “洗牌” with secondary text “随机5只”: change its button fill to a clear pastel mint/teal (#82CEBD range), with a darker teal outline and deep teal-brown text.
- Right “翻转” with secondary text “选1只”: change its button fill to a clear pastel lavender-purple (#AD9ADE range), with a darker purple outline and deep gray-purple text.
All three remain harmonious with the stitched fabric style but noticeably more saturated and higher-contrast than the current cream buttons. Add a crisp inner cream highlight, slightly stronger stitched outline, and a very shallow raised shadow so they are clearly interactive. Keep text highly legible. Do not change their size or order.

CHANGE 2 — REPLACE THE REMOVE ICON
On the “消除” button, remove the rabbit icon completely. Replace it with a simple rounded clear/remove symbol: two small overlapping toy tiles dissolving into a tiny sparkle, combined with a soft rounded X/erase gesture. No animal, no rabbit head, no trash can, no red danger symbol. Keep the icon distinct from shuffle and flip.
Keep “洗牌” as crossing shuffle arrows and “翻转” as a circular flip/turn arrow, visually different from each other.

CHANGE 3 — ADD THE COMBO STATE
Add one slim rounded stitched Combo progress bar centered in the top safe area between the level label and pause button, without covering the hanging star/cloud decorations. The bar has:
- a cream fabric outer track with thin warm-pink stitch outline;
- a vivid but soft pink-to-lavender fill at about 70% remaining;
- exact text centered INSIDE the filled/track area: “连击 ×6”;
- white/cream bold rounded Chinese text with a subtle dark-pink shadow for readability.
Do not show any countdown number, seconds, clock icon or extra Combo label. The quantity must be inside the bar.

STRICT INVARIANTS
Keep exactly 72 rabbits and the first-level pattern unchanged. No board, tray, grid, cells or playfield border. No ducks, whales or other toys. No hint button, restart button, popup, status tip, collision effect, path trail, reward, currency, ad, red dot, logo or watermark. Preserve the stitched flat 2D pastel visual language; no plastic 3D, realistic plush fiber, neon, metallic UI, strong perspective or deep shadows.
```
