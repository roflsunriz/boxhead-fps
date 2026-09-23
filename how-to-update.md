# 更新手順

## 前提

- Node.js 26.x または Bun 1.3.x がインストールされていること
- 初回のみ依存関係をインストールする: `bun install`
- Playwright のブラウザが必要な場合: `bunx playwright install chromium`

## 開発サーバ(Vite)

ソースを直接配信する開発モード。HMR 付き。

```powershell
bun run dev
```

`http://localhost:8787` で起動する(port 8787 固定)。

## ビルドと本番確認

バンドラは Bun のもの(`bun build`)を使用する。rollup / rolldown は使わない。

```powershell
bun run build
```

`dist/` に成果物が出力される。バンドル済み成果物の動作確認は:

```powershell
bun run preview
```

(`http://localhost:8787` で `dist/` を配信)

## GitHub Pages / GitHub Releases リリース

### 初回設定

GitHubのリポジトリで Settings → Pages → Build and deployment → Source を `GitHub Actions` に設定する。この設定にはリポジトリの管理権限が必要。

### デプロイ

リリース対象をコミットしてmainへpushした後、同じコミットへSemVer形式の注釈付きタグを作成してpushする。

```powershell
bun run validate:release-tag -- v1.2.3
git tag -a v1.2.3 -m "v1.2.3"
git push origin v1.2.3
```

`.github/workflows/deploy-pages.yml` がタグ形式を再検証し、依存インストール、型検査、lint、脆弱性監査、Pagesのベースパスを使ったBunビルド、成果物アップロード、デプロイ、GitHub Release公開を順番に実行する。安定版タグはLatest Release、`v1.2.3-rc.1`のようなタグはプレリリースとして掲載される。Actionsを再実行した場合は既存Releaseを検出して重複作成しない。

タグは公開履歴なので、失敗時も削除・付け替えを行わない。修正コミットを作成し、パッチ番号を上げた新しいタグ（例: `v1.2.4`）で再デプロイする。

## 検証方法

`bun run preview`(または任意の静的サーバで `dist/` を 8787 番ポートに配信)した状態で:

```powershell
bun run type-check   # tsc --noEmit、any 禁止・strict
bun run lint         # ESLint (typescript-eslint flat config、src/ と test/ 両方)
bun run format       # Prettier 整形
bun run audit        # bun audit による依存脆弱性スキャン
bun run validate:release-tag -- v1.2.3  # SemVerタグの検証
bun run test         # Playwright E2E、全項目 PASS すること
node test/responsive.js   # 4 ビューポートのレイアウト検証(ALL VIEWPORTS OK が出ること)
```

テストはビルド済み `dist/` を配信したサーバに対して実行すること(ソース直配信ではなく成果物を検証する)。ヘッドレス環境ではポインタロックをスタブして実行する設計。UI 文言は言語設定で変わるため、テストの画面判定は翻訳文字列ではなく `data-screen` / `data-i18n` 属性と要素構造で行うこと。

## 3DモデルとPBRテクスチャの更新

- 製品モデルの公開APIは `src/models/game-models.ts`。カービンは `src/models/carbine-model.ts`、画像テクスチャの割当・部品別UV塗装は `src/models/carbine-materials.ts` で管理する。`src/assets/carbine-surface-atlas.png` はBunがビルド成果物へ同梱するため、ソース側だけでなく `dist/` の画像取得も確認する。
- 樹木は `src/models/broadleaf-tree.ts`（都市のケヤキ・クスノキ風広葉樹）と `src/models/palm-tree.ts`（ヤシ）を編集する。広葉樹は幹から大枝・小枝へ分岐する形と、枝先の葉の間隔を確認する。黄金角を使った配置は、方向の偏りや葉の重なりを抑えるための視覚表現であり、生物学的な成長や日射の最適化を厳密に計算するものではない。確認項目は [verification.md](verification.md) を参照。
- 地表、建物、金属、樹脂、ゴム、樹皮のテクスチャ生成元は `src/textures.ts`。albedoはsRGB、roughness・normal・AOはlinear dataとして別キャンバスへ生成し、同じ画像を複数チャンネルへ使い回さない。
- カービンの参照画像とプロンプトは `art/references/`、`img2threejs` の分析・spec・クロップ・PBRエビデンス・レビュー履歴は `art/img2threejs/carbine/` に置く。単一画像から見えない右側面・下面・内部機構と傷位置は近似であり、追加画像なしに完全一致を主張しない。

Vite開発サーバーを8787番で起動した状態で、見た目のエビデンスを再生成する。

```powershell
node test/capture-model-review.js    # カービン6方向・map-stripped（Google Chromeが必要）
node test/export-carbine-parts.js    # action-ready部品manifest
node test/capture-assets-review.js   # 武器・回復物資・環境小物
node test/capture-game-assets.js     # ゲーム内ボット、味方後頭部IFF、爆発跡
node test/capture-tree-review.js     # 樹木2方向（Google Chromeが必要）
node test/capture-crater-review.js   # クレーター単体の斜光確認
```

モデル更新後は、最低でも次を確認する。

ビルド成果物を配信して `node test/capture-tree-review.js --game` を実行すると、都市とビーチの樹木も撮影できる。

1. 一人称カービンが肩付けの位置にあり、腰だめ・照準時ともストックの大部分が見えない。画面下右を過度に覆わず、実際のマズルからトレーサーが出る。
2. 右クリックごとにADSがオン／オフになり、サイトの赤点が画面中央へ移動してHUDクロスヘアが消える。
3. リロード、バリア使用、死亡、ポーズでADSが解除され、FOVと武器位置が腰だめへ戻る。
4. リロード時に同じマガジングループが抜去・非表示・再挿入される。
5. ボットのカービン、反動、マズルフラッシュ、味方アウトラインが追従し、味方だけヘルメット後頭部のIFFがシアン発光する。
6. pickupと投擲グレネードの取得・物理・爆発判定がモデル置換後も変わらない。
7. カービンが6方向で平面へ潰れず、意図したstock／handguard穴が残る。`/test/model-review.html?interactive=1` で回転・ズーム・分解・部品選択を確認する。
8. クレーターの焦げ中心、低い不規則縁、瓦礫が見え、円形トーラスのケーキ状外周へ戻っていない。

8787番がWindows側の予約などで `EACCES` になる場合は、空きポートを指定できる。

```powershell
bun run dev -- --host 127.0.0.1 --port 18787
$env:MODEL_REVIEW_URL = 'http://127.0.0.1:18787'
node test/capture-model-review.js
node test/export-carbine-parts.js
```

ゲームE2E・画面サイズ確認は `GAME_TEST_URL` でビルド成果物の配信URLを指定する（既定は8787番）。レビューはVite、ゲームE2Eは `dist/` 配信に分ける。

## ロールバック/復旧方針

- ソースは `index.html` / `style.css` / `src/`。構成は README.md の表を参照。問題発生時は Git の該当コミットへ戻せば復旧する。
- ビルド成果物 `dist/` は生成物であり手編集しない。壊れたら `bun run build` で再生成する。
- 3Dモデルの変更を戻す場合は `src/models/`、接続元の `src/main.ts` / `src/items.ts` / `src/enemies.ts` / `src/world.ts`、PBR生成元の `src/textures.ts`、画像テクスチャの `src/assets/` を同じコミット単位で戻す。`art/` の参照・specだけを戻しても実ゲームの形状は戻らない。
- three.js は npm 依存(bundler 解決)のため CDN 障害の影響を受けない。
- typescript-eslint は TS 7 未対応のため、`typescript` は 6.x に固定している。TS 7 対応後の更新時は `typescript-eslint` の対応状況を先に確認すること。
- テストが失敗した場合はまず `test/run.log` の失敗項目名と、8787 ポートで `dist/` が配信されているかを確認すること。UI 文言関連の失敗時は、言語設定(ja/en)の違いが原因ではないかを確認すること。
- PagesデプロイまたはGitHub Release公開が失敗した場合はActionsの `Release SemVer tag` を確認し、PagesのSourceが `GitHub Actions` か、タグが正しいSemVerか、`github-pages` environmentの保護ルールがタグを許可しているか、ワークフローの`contents: write`権限が許可されているかを確認すること。

## Dependabot PR の更新

前提は `.github/dependabot.yml` と PR 用 CI（CI）です。更新 PR の head SHA と `gh pr checks <PR番号>` の結果を確認してください。patch／minor は全チェック成功後に自動取り込みされます。初回 CI 失敗は failed jobs のみを 1 回再実行し、再失敗時は指定した lockfile を再生成し、CI を再実行します。

設定を変えたときは `actionlint .github/workflows/dependabot-automation.yml` と実際の PR の Actions 結果を確認します。問題があれば呼び出し先の共通 workflow SHA を直前の検証済み値へ戻すコミットを push します。取り込まれた依存更新に問題があれば通常の revert コミットで復旧します。

ゲームの操作検証は隔離した Windows runner の Chrome で、build 済み `dist/` を一時 HTTP サーバーから配信して実行します。ローカルではヘッドレスを既定とします。Linux の CI ジョブは lint・型・ビルド・依存監査を確認します。実行環境を変えるときもゲーム E2E の95件を省かず、`verification.md` の時間依存の注意を確認してください。

CI 完了より Dependabot の分類が遅れる場合は、`callback_workflow_file` が指す呼び出し側 workflow を `workflow_dispatch` し、同じ PR 番号・head SHA・全チェックを再確認する。呼び出し側のファイル名を変える際はこの入力も一緒に更新する。
