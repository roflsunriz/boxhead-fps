# カービン材質エビデンス

`img2threejs` 1.4.4 の `extract_pbr_evidence.py` を使い、参照クロップごとに1024pxの独立PBRチャンネルを抽出した。

| 材質          | クロップ                    | 信頼度 | 判定 | 中心色    |
| ------------- | --------------------------- | -----: | ---- | --------- |
| gunmetal      | `detail-zones/receiver.png` |   0.86 | pass | `#454546` |
| grip-polymer  | `detail-zones/grip.png`     |   0.86 | pass | `#3E3E3E` |
| stock-polymer | `detail-zones/stock.png`    |   0.86 | pass | `#4E4D4B` |

各ディレクトリに `*_albedo.png`、`*_roughness.png`、`*_height.png`、`*_normal.png`、`*_ao.png` を保持する。albedoを他チャンネルとして再利用していない。

単一画像の逆推定は真の物性測定ではない。0.86は抽出の技術的信頼度であり、ニュートラル光・斜光・参照合わせのブラウザ描画レビューを通して初めて採用可否を判断する。
