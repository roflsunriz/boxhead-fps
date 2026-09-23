# AGENTS.md

## 作業開始前の必須手順（最優先・例外なし）

1. エージェントは、調査、計画、コマンド実行、スキル利用、ファイル編集、コミット、プッシュを始める前に、必ずリポジトリ直下の `.\COMMON-AGENTS.md` を開き、先頭から末尾まで全文を読む。
2. `COMMON-AGENTS.md` はGit管理外のシンボリックリンクである。`git`や既定のignore設定が有効な`rg --files`の検索結果だけで、ファイルが存在しないと判断してはならない。PowerShellでは最初に次を実行する。

```powershell
Get-Content -Raw -LiteralPath .\COMMON-AGENTS.md
```

3. 読み取りに失敗した場合、出力が省略された場合、または末尾まで読めたことを確認できない場合は、一切の作業を開始せず、パスとシンボリックリンク先を確認して全文を再取得する。必要なら分割して末尾まで読む。
4. 全文を読了するまで、ローカル `AGENTS.md` だけを根拠に作業を続けてはならない。読了後は `COMMON-AGENTS.md` を最優先の指針とし、読了直後の最初の進捗報告で全文を読了したことを明示する。
   このファイルでは `boxhead-fps` 固有の補足だけを記載する。

## Environment

- カービンの公開APIは `game-models.ts`、実形状は `src/models/carbine-model.ts`、画像atlasと部品別UV塗装は `carbine-materials.ts`。profileは前方u/上方yで記述し、ゲームの前方 `-Z` へ変換する。生成画像は `src/assets/` からimportしBunへ同梱させる。`art/` の画像だけを変更してもゲームには反映されない。
- カービンの目視確認では `test/capture-model-review.js`（6方向）とゲームの `test/feature-red-dot-ads.png` を確認する。赤点の投影座標だけではサイト本体による遮蔽を検出できないので、`debugAimOcclusion()` の実交差結果も検証する。撮影は `carbineTexturesReady` を待ってから行う。
- 一人称の銃は肩付けが前提。`main.ts` のカメラ相対位置を前へ押し出すとストック後端が画面を覆う。腰だめ・ADS両方でストックの大部分が視点後方にあることを画像確認し、発射原点は固定距離ではなく実muzzle socketとの一致を検証する。
- 8787番でIPv4/IPv6とも `EACCES` の場合、別ポートでViteを起動し `MODEL_REVIEW_URL` を渡す。E2E/レスポンシブ検証には `GAME_TEST_URL` で別途distのURLを渡せる。2026-09-06は18787/18887で確認。詳細は更新手順。
- 都市の樹木生成は `src/models/broadleaf-tree.ts` の `createBroadleafTreeModel`、ビーチのヤシ生成は `src/models/palm-tree.ts`。都市は `world.ts` の独立シードで形状を生成するため、樹木のディテール変更でマップ配置用乱数を消費しないこと。衝突判定は描画モデルとは別の幹半径を用いる。
- 都市の木はユーザー指定のケヤキ・クスノキ風広葉樹。黄金角による配置、幹から枝への階層分岐、葉の間隔は視覚モデルとして扱い、生物学的な完全再現や厳密な日射最適化を主張しない。ヤシとは別の樹冠・葉形を保ち、変更時は `verification.md` の外観確認を行う。
- 樹木の見た目は `test/tree-review.html` と `node test/capture-tree-review.js` で確認する。後者はインストール済みGoogle Chromeをヘッドレス起動し、CDPで描画情報と画像を取得する。ゲーム全体の既存E2Eは `dist/` 配信で行う。詳しくは `verification.md` を参照。
- ソフトウェア描画のE2Eでは1フレームが1秒以上かかる場合がある。ボットの `nextThink` を長時間固定するとターゲットの視認期限（0.45秒）が切れ反撃できなくなるため、被弾直後の向きを検証した後は通常の索敵更新を許可し、発砲・移動の実際の状態変化を有限時間内で待つ（`test/game.test.js`）。
- 2026-09-23 の GitHub Linux runner はゲーム E2E の WebGL 描画が遅く、時限判定が複数失敗し操作がタイムアウトした。`.github/workflows/ci.yml` は Linux で静的検査とビルド、Windows の隔離したヘッドレス Chrome で `test/game.test.js` を実行する。テストの期待値や操作経路を省かず、変更時は両ジョブを確認する（`verification.md`）。
