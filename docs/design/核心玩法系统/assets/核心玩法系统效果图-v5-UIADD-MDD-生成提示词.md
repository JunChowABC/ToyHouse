# 核心玩法系统效果图 v5 生成记录

- 生成方式：Codex 内置 `imagegen`
- 用例：`ui-mockup`
- 目标画幅：竖屏 9:16，设计基准 1080×1920
- 规则来源：`UI-ADD-核心玩法系统美术需求.v1.1.md`、`MDD-核心玩法系统.v1.0.md`、`UI-核心玩法系统界面交互说明.v1.0.md`
- 风格参考：`核心玩法效果图-v4-花花风参考-最终.png`
- 灯光参考：`bg_coreplay_00_back-v3-dim-warm.png`

## 最终提示词

```text
Use case: ui-mockup.

Create a definitive high-fidelity PORTRAIT 9:16 mobile game core-play system screenshot for design review, based on the supplied project references.

REFERENCE ROLES
- Reference image 1 is the approved PROJECT STYLE AND BOARD COMPOSITION ANCHOR only: keep its soft flat pastel dollhouse language, readable toy proportions, large central board and four exits. Do not simply copy its old HUD.
- Reference image 2 is the approved DIM WARM BEDROOM LIGHTING AND BACKGROUND ANCHOR: use the bedside-lamp warmth, dusty rose and lavender nighttime ambience, while keeping gameplay bright and readable.

CANVAS AND LAYOUT
- Portrait mobile screenshot, intended output 1080×1920.
- Reserve a light, unobtrusive top HUD safe zone of about 176 px; main board dominates the center; reserve a light bottom auxiliary safe zone about 176 px.
- The scene remains visually primary; HUD is secondary.
- Top left: a small cream fabric/cloth label with EXACT Chinese text: “第一夜 · 1-4”.
- Top center: a slim rounded Combo progress bar, about 65% filled, with EXACT text centered INSIDE the bar: “连击 ×6”. Show no countdown number and no seconds.
- Directly below the Combo bar: a small cream fabric status label with EXACT text: “小鸭正在回家”.
- Top right: one small rounded-square pause button with a clear double-vertical-bar pause icon. It is visually disabled/desaturated during the automatic chain.
- Bottom: exactly three equal-width soft pillow-shaped tool buttons in this fixed order, all visually disabled/desaturated during the automatic chain: “消除”, “洗牌”, “翻转”. Use distinct rounded icons for remove, shuffle and flip.
- Do not show a permanent hint button or a permanent restart button. Restart exists only inside the pause popup, which is not open in this screenshot.
- No other text anywhere.

GAME BOARD
- Large rounded pale peach-pink sorting board, nearly front-on and flat, no visible grid.
- EXACTLY four centered edge gaps/exits: one top, one bottom, one left, one right. No extra gaps. All four exits fully visible and not covered by HUD.
- Board interior has enough empty space to understand movement paths.

TOYS — ONLY THESE THREE FAMILIES
- Cream rabbit: 1 unit wide × 2 units long, rounded vertical domino silhouette, long ears, tiny bow.
- Yellow duck: 1×1 square footprint, compact rounded square silhouette, tiny beak and bow.
- Powder-blue whale: 1×3 long horizontal footprint, calm rounded whale graphic.
- Repeated copies are allowed, but keep the layout uncluttered. Do not add any other toy species or generic blocks.

EXACT GAMEPLAY MOMENT
- Show a rabbit that has just slid into the side/end of a whale inside the lower-middle board.
- At the exact contact point, BOTH the moving rabbit AND the struck whale react immediately and simultaneously: slight squash/rebound, a shared warm highlight outline around both toys, and one tiny flat yellow star impact symbol precisely between them. Make it obvious that both objects are affected, with no delayed reaction.
- Elsewhere, show one or two ducks automatically pathfinding through empty space toward any reachable edge gap. Give them only short subtle flat star-dust trails curving toward a side gap. Do NOT use directional arrows and do NOT imply that the duck’s beak/facing determines the exit.
- This is an automatic duck-chain state: gameplay input is locked, therefore toys, the three tools and the pause entry are disabled, but the layout does not shift.

ART DIRECTION
- Soft high-key pastel FLAT 2D illustration, refined cute dollhouse, light paper-cut/sticker feel.
- Thin warm colored outlines, broad clean fills, very shallow inner shadow and small highlight only.
- Delicate cream, blush pink, mint, powder blue, pale lavender, soft yellow; tiny warm gold accents.
- Cozy dim bedtime bedroom around the board: warm bedside lamp, dusty lavender corners, restrained nighttime atmosphere. Board and toys remain high-contrast and legible.
- Similar mood, color softness and flatness to a premium Chinese cozy dollhouse mobile game, but entirely original: do not copy recognizable characters, furniture layout, icons, logos or decorative motifs from any existing game.
- UI plates resemble soft fabric plaques or candy-colored paper labels, low visual weight.

STRICTLY AVOID
thick 3D rendering, realistic plush fibers, PBR materials, glossy plastic, strong perspective, deep cast shadows, metallic tech panels, black vignette, neon, volumetric rays, excessive bloom, visible grid, arrows on ducks, timer numbers, seconds, permanent hint button, permanent restart button, currency, rewards, red notification dots, ads, popups, watermark, logo, bears, toy cars, extra toy species, extra edge gaps.
```

## 画面状态说明

- 展示自动小鸭连锁结算中的瞬间。
- Combo 进度条显示“连击 ×6”，不显示具体秒数。
- 兔子撞到鲸鱼时，主动方与被撞方同时出现撞击反馈。
- 小鸭可从任意可达缺口寻路离场，星屑仅表达路径，不表达朝向限制。
- 自动结算阶段中，玩具、消除/洗牌/翻转与暂停入口均为禁用态。
