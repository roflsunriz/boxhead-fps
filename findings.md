# findings.md

このリポジトリ固有の実現手段と調査知見の正本です。作業前に全文を読み、行動規範は [AGENTS.md](AGENTS.md) と [COMMON-AGENTS.md](COMMON-AGENTS.md) に従ってください。移動元の本文は以下に保持しています。

## 共通方針の適用と具体的な例外

| 項目                       | このリポジトリでの扱い                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 対象の共通ルール           | ブラウザ検証のヘッドレス原則                                                                                                                                                      |
| 理由と適用範囲             | ソフトウェアWebGL描画で時限判定が失敗した実測に基づき、ゲームE2Eの隔離Windows CIだけ `GAME_TEST_HEADED=1` を利用する。ローカルは原則ヘッドレスを維持する。                        |
| 同等の品質を保つ手段・検証 | 同じ期待値と実操作を維持し、Linuxの静的検査・監査・ビルドとWindowsのゲームE2Eを両方確認する。根拠: `test/game.test.js`、`.github/workflows/ci.yml`、[検証記録](verification.md)。 |

## 文書の役割と適用範囲

- 共通ルールの対象は「ローカル AGENTS.md との関係」「設計と実装方針」「検証」「ドキュメント」。この文書は本リポジトリの構成と既存運用に適用し、共通の行動規範を弱めません。
- ファイル配置・ツール・環境をここに集約する理由は、作業規範と実装上の事実を分け、次の作業者が根拠を確認できるようにするためです。下記の既存手段は同じ対象の設定・CI・検証記録と照合して使います。
- README は利用開始・操作、更新手順は更新と復旧、verification.md は検証手順と実測証跡、専門の設計・研究文書は詳細な根拠を担います。これらの用途は維持し、この文書から参照します。
- 更新・検証の代替は一律のBunコマンドに固定せず、下記の採用技術と既存CIに対応する検査を使います。実行不能や未検証の条件は成功扱いせず verification.md に残します。

<a id="agents-1"></a>

## Environment

- カービンの公開APIは `game-models.ts`、実形状は `src/models/carbine-model.ts`、画像atlasと部品別UV塗装は `carbine-materials.ts`。profileは前方u/上方yで記述し、ゲームの前方 `-Z` へ変換する。生成画像は `src/assets/` からimportしBunへ同梱させる。`art/` の画像だけを変更してもゲームには反映されない。
- カービンの目視確認では `test/capture-model-review.js`（6方向）とゲームの `test/feature-red-dot-ads.png` を確認する。赤点の投影座標だけではサイト本体による遮蔽を検出できないので、`debugAimOcclusion()` の実交差結果も検証する。撮影は `carbineTexturesReady` を待ってから行う。
- 一人称の銃は肩付けが前提。`main.ts` のカメラ相対位置を前へ押し出すとストック後端が画面を覆う。腰だめ・ADS両方でストックの大部分が視点後方にあることを画像確認し、発射原点は固定距離ではなく実muzzle socketとの一致を検証する。
- 8787番でIPv4/IPv6とも `EACCES` の場合、別ポートでViteを起動し `MODEL_REVIEW_URL` を渡す。E2E/レスポンシブ検証には `GAME_TEST_URL` で別途distのURLを渡せる。2026-09-06は18787/18887で確認。詳細は更新手順。
- 都市の樹木生成は `src/models/broadleaf-tree.ts` の `createBroadleafTreeModel`、ビーチのヤシ生成は `src/models/palm-tree.ts`。都市は `world.ts` の独立シードで形状を生成するため、樹木のディテール変更でマップ配置用乱数を消費しないこと。衝突判定は描画モデルとは別の幹半径を用いる。
- 都市の木はユーザー指定のケヤキ・クスノキ風広葉樹。黄金角による配置、幹から枝への階層分岐、葉の間隔は視覚モデルとして扱い、生物学的な完全再現や厳密な日射最適化を主張しない。ヤシとは別の樹冠・葉形を保ち、変更時は `verification.md` の外観確認を行う。
- 樹木の見た目は `test/tree-review.html` と `node test/capture-tree-review.js` で確認する。後者はインストール済みGoogle Chromeをヘッドレス起動し、CDPで描画情報と画像を取得する。ゲーム全体の既存E2Eは `dist/` 配信で行う。詳しくは `verification.md` を参照。
- ソフトウェア描画のE2Eでは1フレームが1秒以上かかる場合がある。ボットの `nextThink` を長時間固定するとターゲットの視認期限（0.45秒）が切れ反撃できなくなるため、被弾直後の向きを検証した後は通常の索敵更新を許可し、発砲・移動の実際の状態変化を有限時間内で待つ（`test/game.test.js`）。
- SpiderBench由来の地表画像は `src/assets/spiderbench/` へ配置し、`src/textures.ts` からimportしてBunビルドに同梱する。元の `roof_col.png` や `walls_col.jpg` は複数材質の縦長atlasで、そのままRepeatWrappingすると異なる材質が混ざるため、地面の反復には `grass_col.png`・`sidewalk_col.png`・`ts_pavers.webp` のタイル画像を使う。素材の帰属とライセンス区分はREADMEを参照。
- ゲーム起動時の天候・環境はランダムなので、都市素材のE2E確認では `setWeather(0)` で都市へ切り替えてから画像の読込完了を待つ（`test/game.test.js`）。地下は `setWeather(6)` で確認する。
- 2026-09-23 の GitHub Linux runner はゲーム E2E の WebGL 描画が遅く、時限判定が複数失敗し操作がタイムアウトした。`.github/workflows/ci.yml` は Linux で静的検査とビルド、隔離した Windows runner の Chrome で `test/game.test.js` を実行する。テストの期待値や操作経路を省かず、変更時は両ジョブを確認する（`verification.md`）。
- 2026-10-12 の Dependabot 自動マージでは、PR側のCI成功後も最終mainコミット `c574731` のCI実行がマージ直後の `gh run list --commit` で見つからなかった。最終mainの検証が必要な場合は、実行一覧とhead SHAを確認し、実行がなければ `gh workflow run ci.yml --ref main` で起動してLinux `verify` とWindows `game-e2e` の結果を確認する（`verification.md`）。
- 遅いフレームで固定の待機秒数だけを頼りにすると、手榴弾の爆発前に敵 AI の位置変更へ進み、後続の敵テストも連鎖して失敗する。`test/game.test.js` はクレーターの実生成を待ち、言語ボタンも実ヒット位置へのマウス入力と DOM 更新を確認する。Playwright の強制クリックや期待値緩和で成功扱いにしない。
- GitHub Windows runner のヘッドレス Chrome もソフトウェア描画が遅く時限判定が失敗した。ユーザー操作と隔離された CI VM に限り `GAME_TEST_HEADED=1` で実デスクトップの Chrome を試す。ローカルは原則ヘッドレスを維持し、CI でも実際のゲーム操作・期待値を省かない（`verification.md`）。
- ゲーム開始ボタンは文書遷移せず pointer lock を開始する。Windows の実デスクトップ CI では Playwright の開始ボタンクリックが「予定された遷移の終了」を待って停止したため、`test/game.test.js` の4つの開始ボタンにだけ `noWaitAfter` を指定する。実クリック後の pointer lock と表示状態を確認し、単なる JavaScript click へ置き換えない。
- ホスト runner ではゲームの常時描画を複数タブで並行させると次タブの初期化が遅れる。最初のゲーム検証後にスクリーンショットを保存してからそのタブを閉じ、後続のタブも使用後に閉じる。移動・リロード・死亡/復活は固定秒数ではなく実状態を待ち、リロード中間値は成立したフレームでコピーしてから検査する。2026-10-12 の Windows CI では弾倉抜去撮影の完了後に挿入姿勢の待機を登録すると中間状態を見逃したため、待機を撮影と並行して開始する（`test/game.test.js`、`verification.md`）。
- Windows runner では1フレームに数秒かかり、実時間で計った死亡演出と再出現が同じフレームで完了して倒れ込みを観測できなかった。`src/main.ts` は既存の上限付き `dt` で死亡演出と復活待ちを進める。`deathView` getter は読み取り専用とし、描画フレーム以外で状態を進めない。試合終了時のテストは固定秒数ではなく、倒れ込みと結果画面の成立を期限付きで待つ。
- 海岸の深水域への衝突検査は、波のスクリーンショットを長く待つ前に衝突後の位置を記録する。後から読むと復活後のスポーン位置を誤って衝突位置として扱う。2026-10-12 の長時間Windows CIでは、検査前に死亡・ポーズ・試合終了状態が競合し得るため、環境検査タブの開始時に試合目標を高く設定し、深水へ配置する前に実再開経路と生存を確認して、先行するAI検査後のボットを遠ざける。元の深水衝突位置を確認し、失敗時は状態を出力する。地下壁も固定秒数ではなく実際の押し出しを待つ（`test/game.test.js`、`verification.md`）。

移動元: `AGENTS.md`。

<a id="agents-2"></a>

## 開発依存監査の注意（2026-10-05）

- brace-expansion の3件のAdvisoryに対し、5系は5.0.12で該当範囲を外れる。既存親依存の5系範囲を保ち、package.jsonのoverrideとbun.lockを同時に更新する。監査の省略や閾値緩和で対応せず、CIと同じBunで固定install・監査・既存品質確認を行う。詳細はverification.md。
- 2026-10-12 の Dependabot PR #9・#10・#11 の Linux `verify` 失敗は、PR自体の更新ではなく共通の source-map-js@1.2.1 脆弱性（GHSA-68fv-2mgg-jv7q）が原因。PostCSS の `^1.2.1` 範囲内で bun.lock を 1.2.2 へ更新できる。PRを処理する前に main の監査と固定installを確認する（`verification.md`）。

移動元: `AGENTS.md`。

<a id="agents-3"></a>

## ミニマップの幾何fixture（2026-10-05）

- player(0,0)は都市の中央障害物内で、通常プレイ中は衝突処理で押し出される。botもAIで移動するため、固定座標の幾何検査はブラウザの実pointer lock解除（fallbackはEscape）による既存ポーズ経路を使い、paused表示を待ってから入力を設定する。ポーズ中もminimapは描画される。2描画frameを有限期限付きで待ち、元の方向・3pixel未満の許容値を維持する。finallyで実再開ボタンを押し、後続の移動・衝突・AI検査を省かない。headlessの合成Escapeだけではnative pointer lockが解除されない場合がある。

移動元: `AGENTS.md`。

<a id="readme-1"></a>

## GitHub PagesとReleasesへのリリース

リポジトリの Settings → Pages → Build and deployment → Source を、初回だけ `GitHub Actions` に設定する。
その後、SemVer形式のタグをpushすると、型検査・lint・依存監査・Pages用ビルドを通過した成果物が自動デプロイされ、GitHub Releasesにも自動掲載される。

```powershell
git tag -a v1.3.2 -m "v1.3.2"
git push origin v1.3.2
```

上のタグは次の未使用バージョンの例です。実行前に `git tag --list` で既存タグを確認し、`CHANGELOG.md` に同じバージョンの節を作成してください。`v1.3.2`、`v1.3.2-rc.1`、`v1.3.2+build.4`などを受け付ける。不正な形式のタグはデプロイ前に失敗する。Pagesのベースパスはリポジトリ設定から自動取得するため、プロジェクトサイトとカスタムドメインの両方に対応する。安定版はLatest Release、`-rc.1`などはプレリリースとして自動公開される。

移動元: `README.md`。

<a id="readme-2"></a>

## 検証

`bun run preview` で `dist/` を配信した状態で、次を実行する。

```powershell
bun run type-check   # tsc --noEmit (strict, any 禁止)
bun run lint         # ESLint (typescript-eslint flat config)
bun run format       # Prettier 整形
bun run audit        # bun audit による依存脆弱性スキャン
bun run validate:release-tag -- v1.2.3  # リリースタグ形式の確認
bun run test         # Playwright E2E
node test/responsive.js   # 複数ビューポートでのレイアウト検証
```

E2E テストはビルド済み `dist/` 成果物に対して実行する。詳細は [how-to-update.md](how-to-update.md) を参照。

移動元: `README.md`。

<a id="readme-3"></a>

## 構成

| ファイル                                                          | 責務                                                                 |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/main.ts`                                                     | 入力・射撃・姿勢・バリア・マッチ進行・メインループ                   |
| `src/items.ts`                                                    | ランダムアイテム、取得処理、グレネード物理・爆発                     |
| `src/persistent-effects.ts`                                       | 弾倉・弾痕・死体の生成、物理、上限付き保持                           |
| `src/minimap.ts`                                                  | プレイヤー中心の回転式ミニマップ描画と座標変換                       |
| `src/beach-waves.ts`                                              | ビーチの立体海面、動的法線、岸へ進む白波                             |
| `src/world.ts`                                                    | シーン・カメラ・ライティング・3 環境の生成・衝突判定・ウェイポイント |
| `src/weather.ts`                                                  | 大気プリセット・雨・雷・星空                                         |
| `src/enemies.ts`                                                  | ボット AI(経路探索・視覚・戦闘・スキルランク)                        |
| `src/ui.ts`                                                       | HUD・オーバーレイの DOM 操作                                         |
| `src/i18n.ts`                                                     | 日本語 / 英語文字列辞書                                              |
| `src/textures.ts`                                                 | 手続きテクスチャ生成と画像素材の読み込み                             |
| `src/models/game-models.ts`                                       | カービン、グレネード、回復物資、ヒトデとヤシ生成API                  |
| `src/models/carbine-model.ts` / `src/models/carbine-materials.ts` | カービンの立体形状、部品別UV・画像テクスチャ・材質                   |
| `src/models/broadleaf-tree.ts` / `src/models/palm-tree.ts`        | 都市の広葉樹とビーチのヤシの手続き型モデル                           |
| `src/audio.ts`                                                    | Web Audio API によるゲーム効果音                                     |
| `src/types.ts` / `src/dom.ts` / `src/random.ts`                   | 共有型・DOM ヘルパー・シード固定 RNG                                 |

移動元: `README.md`。

<a id="readme-4"></a>

## 3Dアート参照と検証

オリジナルのカービン参照画像、生成プロンプト、`img2threejs` の分析・spec・PBR抽出・比較結果は `art/` に保存している。カービンは `src/models/carbine-model.ts` で編集可能なThree.js階層として構築し、`src/assets/carbine-surface-atlas.png` の金属・樹脂・ゴム画像を表面に貼り付ける。部品別の擦れと光沢・凹凸を組み合わせて質感を表現する。参照に写っていない部分と局所的な傷は近似である。

開発サーバー起動中は、カービン6方向、全資産、クレーター、ゲーム内ボットのレビュー画像を再生成できる。`/test/model-review.html?interactive=1` では回転・拡大・分解表示・部品選択でモデルを確認できる。コマンドは [how-to-update.md](how-to-update.md) を参照。

移動元: `README.md`。

<a id="readme-5"></a>

## 依存更新の自動処理

Dependabot は対象の依存関係を毎週確認します。patch／minor 更新は PR のチェック（CI）が成功した後に自動で squash merge されます。CI の失敗ジョブは 1 回だけ再実行します。再失敗時は指定した lockfile を再生成し、CI を再実行します。major 更新は手動で確認します。

移動元: `README.md`。

## 根拠と検証記録

- [README.md](README.md): 利用者向けの導入と操作。
- [verification.md](verification.md): 検証手順、実測結果、未確認事項。
- [how-to-update.md](how-to-update.md): 更新・復旧の実手順。
