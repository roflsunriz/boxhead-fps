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
- 2026-09-23 の GitHub Linux runner はゲーム E2E の WebGL 描画が遅く、時限判定が複数失敗し操作がタイムアウトした。`.github/workflows/ci.yml` は Linux で静的検査とビルド、隔離した Windows runner の Chrome で `test/game.test.js` を実行する。テストの期待値や操作経路を省かず、変更時は両ジョブを確認する（`verification.md`）。
- 遅いフレームで固定の待機秒数だけを頼りにすると、手榴弾の爆発前に敵 AI の位置変更へ進み、後続の敵テストも連鎖して失敗する。`test/game.test.js` はクレーターの実生成を待ち、言語ボタンも実ヒット位置へのマウス入力と DOM 更新を確認する。Playwright の強制クリックや期待値緩和で成功扱いにしない。
- GitHub Windows runner のヘッドレス Chrome もソフトウェア描画が遅く時限判定が失敗した。ユーザー操作と隔離された CI VM に限り `GAME_TEST_HEADED=1` で実デスクトップの Chrome を試す。ローカルは原則ヘッドレスを維持し、CI でも実際のゲーム操作・期待値を省かない（`verification.md`）。
- ゲーム開始ボタンは文書遷移せず pointer lock を開始する。Windows の実デスクトップ CI では Playwright の開始ボタンクリックが「予定された遷移の終了」を待って停止したため、`test/game.test.js` の4つの開始ボタンにだけ `noWaitAfter` を指定する。実クリック後の pointer lock と表示状態を確認し、単なる JavaScript click へ置き換えない。
- ホスト runner ではゲームの常時描画を複数タブで並行させると次タブの初期化が遅れる。最初のゲーム検証後にスクリーンショットを保存してからそのタブを閉じ、後続のタブも使用後に閉じる。移動・リロード・死亡/復活は固定秒数ではなく実状態を待ち、リロード中間値は成立したフレームでコピーしてから検査する（`test/game.test.js`、`verification.md`）。
- Windows runner では1フレームに数秒かかり、実時間で計った死亡演出と再出現が同じフレームで完了して倒れ込みを観測できなかった。`src/main.ts` は既存の上限付き `dt` で死亡演出と復活待ちを進める。`deathView` getter は読み取り専用とし、描画フレーム以外で状態を進めない。試合終了時のテストは固定秒数ではなく、倒れ込みと結果画面の成立を期限付きで待つ。
