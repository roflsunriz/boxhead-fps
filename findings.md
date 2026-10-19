# 調査知見

- 実ゲームのassetは `src/assets` からimportしてbundleへ含める。`art/` だけの画像変更は反映されない。複数材質atlasをRepeatWrappingせず、地面には単材質tileを使う。
- model profileの前方u/上方yはゲームの前方 `-Z` へ変換する。銃をcamera前へ押すとstockが画面を覆うため、腰だめ/ADSでstockを視点後方に置き、発射原点は実muzzle socketへ合わせる。
- procedural treeはmap配置とは独立seedで形状を生成し、detail変更で配置用乱数を消費しない。描画modelとcollision幹半径も別管理。
- WebGL software描画は1 frame数秒かかる。固定sleepや実時間だけに依存せず、crater、reload中間値、death view、respawn、collisionなど実状態を期限付きで待つ。観測対象は長い撮影前にsnapshotする。
- Linux/Windows headlessで時限E2Eが失敗したため、ゲームE2Eだけ隔離Windows desktopで `GAME_TEST_HEADED=1` を使う。Linuxの静的検査・buildと両方を通し、期待値を緩めない。
- 開始buttonはnavigationでなくpointer lockを開始するため、そのbuttonだけ `noWaitAfter` を使う。実click後のpointer lockと表示状態を確認し、JavaScript clickへ置換しない。
- 常時描画tabを並列に残すと次tabの初期化が遅れる。各scenario後に証拠を保存してtabを閉じ、中間状態のwaitは操作・撮影と並行開始する。
- minmapの固定幾何fixtureはAI移動を止めるため実pointer lock解除→pause表示を待って設定し、finallyで実再開する。合成Escapeだけではnative lockが外れない場合がある。
- 天候/環境は起動時random。都市assetは `setWeather(0)`、地下は `setWeather(6)` 後にasset loadを待って検証する。
- Dependabot merge直後にmain CIが自動起動しないことがある。head SHAのrunを確認し、なければmain refへworkflowを明示起動してLinux verifyとWindows game E2Eを確認する。
