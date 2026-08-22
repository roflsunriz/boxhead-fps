# Boxhead FPS

Three.js 製のブラウザ向け FPS ゲーム。TypeScript + Vite(開発)/ Bun バンドラ(ビルド)で構成する。

## ゲーム内容

- WASD 移動 / マウス視点 / クリック長押しのフルオート射撃 / R リロード / Shift ダッシュ / Space ジャンプ
- C でしゃがみ、X でうつぶせをトグル。姿勢に応じて視点高と移動速度が変化する
- F でバリアセルを使用し、充填ゲージと一人称アニメーションの完了後にバリアを 50 回復する
- G でグレネードを投射する。最大所持数は 5 個で、時限爆発の範囲内にいるボットへ距離減衰ダメージを与える
- マップ上にバリアセル、ヘルスキット、グレネードが各 5 個ずつランダム出現し、接近すると取得できる
- 射撃音・被弾音・アイテム取得音・バリア充填音・爆発音と、攻撃元を示す円周ダメージインジケーターを搭載
- ヘルスがゼロになると前後左右のいずれかへランダムに倒れ込み、地面へ視点が落ちながら画面全体が赤く染まる死亡演出を搭載
- 全マップに高さ2m以上の遮蔽物を高密度配置。都市のコンテナ・L字壁・タンク、ビーチの大型岩・木壁・監視小屋、地下の大型箱・防爆壁・タンクを利用できる
- チームデスマッチ: 青チーム(プレイヤー + アライボット 3)vs 赤チーム(ボット 4)。先に 20 キルで勝利、死亡後はリスポーン
- ボット AI: ウェイポイントグラフ経路探索、視界による索敵(壁で遮蔽)、個別の体力・弾薬・リロード・ジャンプ・スプリント、Beginner〜Pro のスキルランク(高スキルほど正確かつジグザグ回避を行う)
- ボットの交戦距離は最大42m。12mを超えると距離に応じて命中率と連射速度が大きく低下し、遠距離から一方的に狙撃されにくい
- 大気プリセット(Sunny / Cloudy / Rainy / Thunderstorm / Night / Beach Sunset / Underground)を読み込みごとにランダム適用。雨・雷フラッシュ・星空・懐中電灯を含む
- Beach Sunset と Underground は雰囲気だけでなくマップ自体が変化する。ビーチは岸へ進む立体波・動く白波・ヤシの木・岩場・ヒトデや魚、アンダーグラウンドはコンクリート天井と柱に囲まれた地下空間
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
bun run test         # Playwright E2E (65 項目)
node test/responsive.js   # 複数ビューポートでのレイアウト検証
```

E2E テストはビルド済み `dist/` 成果物に対して実行する。詳細は [how-to-update.md](how-to-update.md) を参照。

## 構成

| ファイル                                        | 責務                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `src/main.ts`                                   | 入力・射撃・姿勢・バリア・マッチ進行・メインループ                   |
| `src/items.ts`                                  | ランダムアイテム、取得処理、グレネード物理・爆発                     |
| `src/beach-waves.ts`                            | ビーチの立体海面、動的法線、岸へ進む白波                             |
| `src/world.ts`                                  | シーン・カメラ・ライティング・3 環境の生成・衝突判定・ウェイポイント |
| `src/weather.ts`                                | 大気プリセット・雨・雷・星空                                         |
| `src/enemies.ts`                                | ボット AI(経路探索・視覚・戦闘・スキルランク)                        |
| `src/ui.ts`                                     | HUD・オーバーレイの DOM 操作                                         |
| `src/i18n.ts`                                   | 日本語 / 英語文字列辞書                                              |
| `src/textures.ts`                               | 手続きテクスチャ生成                                                 |
| `src/audio.ts`                                  | Web Audio API によるゲーム効果音                                     |
| `src/types.ts` / `src/dom.ts` / `src/random.ts` | 共有型・DOM ヘルパー・シード固定 RNG                                 |

## ライセンス

three.js は MIT License。その他のコードも MIT として扱う。
