# 更新手順

## 前提

- Node.js 26.x または Bun 1.3.x がインストールされていること
- 初回のみ依存関係をインストールする: `bun install`(または `npm install`)
- Playwright のブラウザが必要な場合: `bunx playwright install chromium`

## 起動方法

ES Modules をローカルサーバ経由で配信する必要があるため、静的サーバで起動する。

```powershell
bunx serve -l 8787 .
```

起動後、ブラウザで `http://localhost:8787` を開く。「CLICK TO PLAY」で開始する。

## 検証方法

サーバ起動状態で以下を実行する。29 項目すべて PASS すること。

```powershell
node test/game.test.js
```

視点操作の個別検証には `test/look.js`、任意タイミングのスクリーンショットには `test/shot.js` を使える。

## ロールバック/復旧方針

- ゲーム本体は `index.html` / `style.css` / `game.js` の 3 ファイルのみで、外部ビルド工程はない。問題発生時は Git の該当コミットへ戻せば復旧する。
- Three.js は CDN(importmap で unpkg の three@0.160.0)から読み込む。オフライン環境や CDN 障害時に起動しない場合は、同バージョンをローカル同梱に切り替えることを検討すること。
- テストはポインタロックが使えないヘッドレス環境では `document.pointerLockElement` をスタブして実行する設計になっている。テストが失敗した場合はまず `test/run.log` の失敗項目名と、サーバが 8787 ポートで起動しているかを確認すること。
