# Boxhead FPS

Three.js 製のブラウザ向け FPS ゲーム。TypeScript + Vite(開発)/ Bun バンドラ(ビルド)で構成する。

## ゲーム内容

- WASD 移動 / マウス視点 / クリック射撃 / R リロード / Shift ダッシュ / Space ジャンプ
- ウェーブ制の敵(人型ロボット)との戦闘。倒すとスコア加算、ウェーブ毎に強化
- 大気プリセット(Sunny / Cloudy / Rainy / Thunderstorm / Night / Beach Sunset / Underground)を読み込みごとにランダム適用。雨・雷フラッシュ・星空・懐中電灯を含む
- Beach Sunset と Underground は雰囲気だけでなくマップ自体が変化する。ビーチは波打つ海・ヤシの木・岩場・ヒトデや魚、アンダーグラウンドはコンクリート天井と柱に囲まれた地下空間
- UI は日本語 / 英語対応(右上の JA/EN ボタンで切替。設定は localStorage に保存)

## セットアップ

```powershell
bun install
bunx playwright install chromium
```

必要環境: Node.js 26.x または Bun 1.3.x

## 開発

```powershell
bun run dev
```

`http://localhost:8787` で HMR 有効の開発サーバが起動する。

## ビルドと確認

```powershell
bun run build     # dist/ へバンドル出力(Bun のバンドラ使用。rollup/rolldown 不使用)
bun run preview   # dist/ を 8787 番ポートで配信
```

## 検証

`bun run preview` で `dist/` を配信した状態で:

```powershell
bun run type-check   # tsc --noEmit (strict, any 禁止)
bun run lint         # ESLint (typescript-eslint flat config)
bun run format       # Prettier 整形
bun run audit        # bun audit による依存脆弱性スキャン
bun run test         # Playwright E2E (31 項目)
node test/responsive.js   # 複数ビューポートでのレイアウト検証
```

E2E テストはビルド済み `dist/` 成果物に対して実行する。詳細は [how-to-update.md](how-to-update.md) を参照。

## 構成

| ファイル                                        | 責務                                                     |
| ----------------------------------------------- | -------------------------------------------------------- |
| `src/main.ts`                                   | 入力・射撃・ウェーブ進行・メインループ・ブートストラップ |
| `src/world.ts`                                  | シーン・カメラ・ライティング・建物/木の生成・衝突判定    |
| `src/weather.ts`                                | 大気プリセット・雨・雷・星空                             |
| `src/enemies.ts`                                | 敵モデル生成・スポーン・ダメージ処理                     |
| `src/ui.ts`                                     | HUD・オーバーレイの DOM 操作                             |
| `src/i18n.ts`                                   | 日本語 / 英語文字列辞書                                  |
| `src/textures.ts`                               | 手続きテクスチャ生成                                     |
| `src/types.ts` / `src/dom.ts` / `src/random.ts` | 共有型・DOM ヘルパー・シード固定 RNG                     |

## ライセンス

three.js は MIT License。その他のコードも MIT として扱う。
