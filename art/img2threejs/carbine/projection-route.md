# 投影ルート判断

- 判定: `procedural-finish`
- 理由: 参照は特定ブランド／迷彩／印刷パターンの一致を求める対象ではなく、gunmetal、charcoal polymer、rubber、tan accentという単色系の材質分離が本質である。
- 実装: 参照クロップから色域とPBR推定を取得するが、写真に焼き込まれたスタジオ照明や傷をalbedoへ投影しない。albedo、roughness、height/normal、AOを決定論的かつ独立に生成し、任意方向のゲーム照明へ応答させる。
- 例外: cyan indicatorと琥珀色optic lensは局所材質として独立実装する。
- 制約: 参照と傷位置が完全一致するとは主張しない。輪郭、材質カテゴリ、摩耗の頻度・方向を合わせるゲーム向け近似とする。
