# 核心玩法系统效果图 v6（UI-ADD v1.1）生成记录

- 生成方式：Codex 内置 `imagegen`
- 用例：`ui-mockup`
- 目标画幅：竖屏 9:16，设计基准 1080×1920
- 状态：后续关卡自动小鸭连锁中，同时展示兔子撞击鲸鱼的即时双方反馈
- 规则来源：`UI-ADD-核心玩法系统美术需求.v1.1.md`、`MDD-核心玩法系统.v1.0.md`、`UI-核心玩法系统界面交互说明.v1.0.md`
- 风格参考：`核心玩法系统效果图-v5-UIADD-MDD-暖光-1080x1920.png`
- 灯光参考：`bg_coreplay_00_back-v3-dim-warm.png`

## 最终提示词

```text
Use case: ui-mockup
Asset type: high-fidelity mobile game core gameplay system screenshot, portrait 1080x1920 design review
Primary request: Generate the definitive core gameplay system effect image for the project, strictly following UI-ADD core gameplay art requirements v1.1, the MDD core gameplay rules, and the UI core gameplay interaction specification v1.1.

Input images and roles:
- Image 1 is the approved project style and board composition anchor only. Preserve its soft flat pastel dollhouse mood, rounded sorting board, four exits, and readable rabbit/duck/whale proportions. Do not copy its outdated HUD.
- Image 2 is the approved dim warm bedroom background and lighting anchor. Use its bedside-lamp warmth, dusty rose and lavender night ambience.

Scene/backdrop:
A cozy bedtime dollhouse bedroom in dim warm light, with a small bedside lamp, dusty rose wall, muted lavender curtains and rug, and gentle paper-cut decor. The central gameplay board must remain bright, readable and visually primary.

Composition and safe areas:
- Portrait 9:16 mobile screenshot, intended output 1080x1920.
- Top safe HUD area about 176 px, central board area, bottom auxiliary tool area about 176 px.
- Main board large rounded pale peach-pink sorting board, nearly front-on, no grid.
- Exactly four centered edge gaps/exits: one top, one bottom, one left, one right. No extra gaps. Keep all four fully visible and unobstructed.

Current gameplay state to depict:
Show a later-level automatic duck-chain moment with a rabbit just colliding into the side/end of a whale in the lower-middle board. At the exact contact frame, the moving rabbit AND the struck whale simultaneously show slight squash/rebound, shared warm highlight outline and one tiny flat yellow star impact at their touching edge. No delay and no effect on only one toy.
Elsewhere show one or two yellow ducks automatically pathfinding through empty four-direction cells toward reachable edge gaps, with subtle short star-dust trails only. Do not draw arrows and do not imply that beak/facing direction controls the exit.
Automatic duck-chain is active: all board input, all three tools and the pause button are visibly disabled/desaturated; show a small local status tip under the Combo bar reading exactly “小鸭正在回家”.

HUD — STRICT v1.1:
- Top left: a small cream cloth label with exact text “第一夜 · 1-4”.
- Top center: a slim rounded Combo progress bar about 65% filled, with exact text centered inside the bar “连击 ×6”. Do not show any seconds or countdown number.
- Top right: one circular pause button with a clear double-vertical-line pause icon. Keep it as a pause symbol, not restart, refresh, gear, or exit. Since auto-chain is active, it is disabled/desaturated but its outline and double bars remain readable.
- Bottom: exactly three equal-width soft capsule/pillow tool buttons, fixed order left-to-right: “消除”, “洗牌”, “翻转”. Each has a distinct friendly icon and a smaller secondary dynamic description: “选2只”, “随机5只”, “选1只”. Because auto-chain is active, all three tools are disabled/desaturated, expressed through opacity plus outline/icon treatment, not color alone. Do not include a hint button, lightbulb hint icon, restart button, rotate arrow, or any other permanent button.
- No other UI text anywhere. Do not create a pause popup in this image; show the in-level auto-chain state only.

Toys — ONLY these three families:
- Cream rabbit, 1 unit wide x 2 units long, vertical rounded domino body, long ears, tiny bow; repeats allowed.
- Yellow duck, 1 x 1 compact rounded square footprint, tiny beak and bow; not clickable.
- Powder-blue whale, 1 unit wide x 3 units long horizontal footprint, calm rounded whale graphic; repeats allowed.
No bears, cars, blocks, generic tokens, or extra species.

Art direction:
Soft flat 2D pastel illustration with refined cute dollhouse and light paper-cut/sticker feel, matching the project’s approved flat style. Thin warm outlines, broad clean fills, extremely shallow inner shadow and tiny highlights only; no plastic 3D. Palette cream, blush pink, mint, powder blue, pale lavender, soft yellow, small warm-gold accents. Scene-first, HUD secondary. Warm lamp lighting but high gameplay contrast. Entirely original; do not copy recognizable characters, furniture layouts, logos, icons or motifs from any existing game.

Strict constraints / avoid:
No permanent hint button, no permanent restart button, no restart arrow, no gear icon, no pause popup, no grid, no extra edge gaps, no timer digits, no seconds, no currency, no ads, no rewards, no red dots, no banners, no watermark, no logo, no thick 3D, no realistic plush fibers, no PBR, no glossy plastic, no deep cast shadows, no metallic tech panels, no neon, no black vignette, no excessive bloom, no volumetric rays, no directional arrows on ducks, no facing-direction implication.
```

## 画面状态说明

- 局内展示后续关卡自动小鸭连锁状态。
- Combo 数量写在进度条内，不显示具体秒数。
- 兔子与鲸鱼在接触当帧同步显示回弹、高亮与撞击粒子。
- 小鸭沿四方向可达路径向任意边缘缺口离场，不以面朝方向判定。
- 自动结算期间，盘面、三个道具和右上暂停均为禁用态。
- v1.1 已移除局内常驻提示、重开按钮；重开仅存在于暂停弹窗内。
