# FPSカービン参照画像の分析

## 判定

- 対象: オリジナルの短銃身モジュラーカービン
- 分類: `object` / hard-surface / mechanical / compound articulated assembly
- 適合性: pass。単一対象が高解像度で孤立し、輪郭、主要材料、側面と上面の奥行き手掛かり、接続部が読める。
- 用途: リアルタイムブラウザFPSの一人称武器、ボット携行武器、投棄弾倉の共通ファクトリ
- 精度表現: 単一3/4ビューに基づくゲーム向け近似。右側面、下面、内部機構は推定であり、製造寸法や実銃再現ではない。

## Layer 1: 識別と分類

矩形レシーバー、前方の有孔ハンドガード、円筒バレル、マズルブレーキ、下方へ曲がる着脱式マガジン、後方ストック、下方ピストルグリップ、上面レールと小型リフレックスサイトから成る携行火器。対象確信度 0.98。

## Layer 2: 全体形状と輪郭

- 主軸は銃身方向。全長を1.0とすると、ストック約0.24、レシーバー約0.31、ハンドガード約0.28、露出バレル／マズル約0.17。
- 上面はほぼ連続した低い直線。下面はグリップとマガジンで大きく中断される非対称輪郭。
- 奥行きはレシーバーを基準に、ハンドガードがやや細く、サイトと操作部が局所的に張り出す。
- 大部分は `assembled-solid`。グリップとストックのパッドは丸みのある連続断面、曲面マガジンは浅いロフト形状。

## Layer 3: macro → meso → micro

- macro: stock assembly, receiver assembly, handguard assembly, barrel assembly, grip assembly, magazine assembly, optic assembly。
- meso: buffer tube, butt pad, upper/lower receiver, trigger guard, ejection port, top rail, lower accessory rail, vent system, muzzle brake, sight hood, magazine floor plate。
- micro: fastener rows, panel seams, rail teeth, selector controls, cyan indicator, molded grip stipple, edge bevels, longitudinal brushing, scratches and edge wear。

## Layer 4: 空間関係

- stock assembly は receiver rear socket へ円筒バッファチューブを介して overlap 接続。
- grip assembly は lower receiver 下後部へ embedded 接続。
- magazine は magwell socket へ上端を埋め込み、着脱可能な独立ピボットを持つ。
- handguard は upper receiver 前面へ overlap 接続し、内部の barrel を包む shell。
- barrel は receiver 前方ソケットから handguard 内部を通り、muzzle brake に socket 接続。
- optic は top rail 上へ surface-contact、fastener で固定。

## Layer 5-6: PBR材質と仕上げ

- parkerized gunmetal: metalness 0.85、roughness 0.34前後。微細な方向性ブラッシング、エッジだけroughness低下、浅い擦り傷。
- charcoal polymer: metalness 0、roughness 0.72前後。グリップは微細な凹凸、ストックは弱い成形ムラ。
- muted tan polymer/paint: metalness 0.05、roughness 0.58前後。ストックチューブ外装、下部レール、マガジン床板。
- rubber butt pad: metalness 0、roughness 0.94。大きめの溝と接触摩耗。
- cyan indicator: emissive cyan。小面積でブルームに頼らず読める強度。
- albedo、roughness、height/normal、AOは独立チャンネルとして生成する。

## Layer 7: 識別特徴

1. ハンドガード両側の長円形ベント列。
2. 上面全長の反復ピカティニーレール歯。
3. 角を落とした箱型リフレックスサイトフード。
4. レシーバー側面の深い排莢ポートと操作レバー。
5. 三角形の肉抜きを持つコンパクトストック。
6. 後方へ傾くテクスチャ付きピストルグリップ。
7. 前方へ曲がる分節付きマガジンとtan床板。
8. 多孔式マズルブレーキと暗い銃口穴。
9. 控えめなtanアクセントと小型cyanインジケーター。
10. 主要外周の実ジオメトリベベルと露出エッジ摩耗。

## Layer 8: 不確実性

- 右側面の操作部、下面の詳細、ボルト内部、ストック後面はhidden。
- 単眼画像からの断面幅は推定。正面／後面の非対称性は保証しない。
- 表面の傷は参照と完全一致させず、決定論的な分布として近似する。
- ブランド、ロゴ、シリアル、実銃固有部品は意図的に持たせない。

## 品質契約

- 完了条件: 一人称3/4ビューとボット側面ビューでカービンとして即座に読め、主要7アセンブリが接続され、マガジン／マズル／グリップの既存ゲームソケットを維持し、平面スラブではない断面と独立PBR応答を持つ。
- 最低構成: macro 7、meso 12、micro 10、材質5、反復システム3（レール歯、ベント、fastener）。
- 必須ビュー: 一人称、参照に近い左3/4、右3/4、上面、銃口側。
- `continue` を阻止する失敗: マガジン／グリップ／ストックの浮遊、銃口穴の欠落、ハンドガードが無孔箱に見える、側面だけ合う平面押し出し、金属とポリマーが同じ反射、既存リロード／発砲ソケットの破損。
