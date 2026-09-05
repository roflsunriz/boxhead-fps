# カービン表面テクスチャ

- 制作: 組み込みimagegen、2026-09-06。
- 採用画像: `src/assets/carbine-surface-atlas.png`（1254×1254、四象限atlas）。依頼した2048pxとは異なる実出力寸法を採用している。
- 左上: 摩耗した濃灰色の金属。右上: 粒状の黒い成形樹脂。左下: ストック用の細かい皺のある黒色表皮。右下: オリーブ寄りのタン色樹脂。
- 画像は色の情報として使用。roughness/normalは独立チャンネル、外周の擦れは各部品のUV上に追加する。単眼の参照から物性や傷位置を厳密に復元したものではない。

## 生成プロンプト

Use case: photorealistic-natural. Asset type: 3D game PBR base-color texture atlas, not a rendered object. Create a high resolution square 2048x2048 image containing exactly four equal square material swatches filling the four quadrants edge-to-edge, no gaps, no text, no border. These are flat diffuse albedo textures scanned orthographically, even neutral lighting, no specular highlights, no cast shadows, no perspective. Upper-left: worn dark charcoal phosphate-coated gunmetal, neutral gray roughly RGB 65 66 67, exceptionally realistic fine mottled micro-grain, sparse tiny hairline machining scratches, rubbed patches, minute exposed steel flecks, restrained wear not rusty or damaged. Upper-right: black injection-moulded polymer for a carbine grip, closely packed irregular tiny pebble stipple, dark charcoal RGB 38 39 40, hand-polished high spots, natural microtexture. Lower-left: charcoal black rubberized stock cheek pad, dense fine wrinkled leather-like polymer skin, subtle scuffs and molding texture, dark RGB 35 36 36. Lower-right: muted olive taupe glass-filled nylon for stock frame and magazine floorplate, RGB 80 76 63, subtle fiber and fine matte porous granulation with occasional pale scuff. Fine realistically sized material detail throughout, no large geometric objects, no gun parts, no bolts, no grooves, no decorative patterns, no logos. Each quadrant must be independently tileable across its own boundaries, and its entire square filled with its material. Neutral physically plausible diffuse color. The result will be UV mapped onto detailed 3D geometry and lit dynamically.
