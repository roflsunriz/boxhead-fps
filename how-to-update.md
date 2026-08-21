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

## 検証方法

`bun run preview`(または任意の静的サーバで `dist/` を 8787 番ポートに配信)した状態で:

```powershell
bun run type-check   # tsc --noEmit、any 禁止・strict
bun run lint         # ESLint (typescript-eslint flat config、src/ と test/ 両方)
bun run format       # Prettier 整形
bun run audit        # bun audit による依存脆弱性スキャン
bun run test         # Playwright E2E、31 項目すべて PASS すること
node test/responsive.js   # 4 ビューポートのレイアウト検証(ALL VIEWPORTS OK が出ること)
```

テストはビルド済み `dist/` を配信したサーバに対して実行すること(ソース直配信ではなく成果物を検証する)。ヘッドレス環境ではポインタロックをスタブして実行する設計。UI 文言は言語設定で変わるため、テストの画面判定は翻訳文字列ではなく `data-screen` / `data-i18n` 属性と要素構造で行うこと。

## ロールバック/復旧方針

- ソースは `index.html` / `style.css` / `src/`(9 モジュール)。構成は README.md の表を参照。問題発生時は Git の該当コミットへ戻せば復旧する。
- ビルド成果物 `dist/` は生成物であり手編集しない。壊れたら `bun run build` で再生成する。
- three.js は npm 依存(bundler 解決)のため CDN 障害の影響を受けない。
- typescript-eslint は TS 7 未対応のため、`typescript` は 6.x に固定している。TS 7 対応後の更新時は `typescript-eslint` の対応状況を先に確認すること。
- テストが失敗した場合はまず `test/run.log` の失敗項目名と、8787 ポートで `dist/` が配信されているかを確認すること。UI 文言関連の失敗時は、言語設定(ja/en)の違いが原因ではないかを確認すること。
