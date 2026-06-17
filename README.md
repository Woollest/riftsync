# RiftSync

RiftSync は、League of Legends のソロQ向けピック支援Webアプリです。

味方1人のロールとチャンピオンを入力すると、自分のロールで相性の良いおすすめチャンピオンを3体表示します。初心者がチャンピオンセレクト中に短時間で判断できるように、日本語UI、アイコン中心、短い理由表示を重視しています。

## 主な機能

- 味方ロール、味方チャンピオン、自分ロールを選ぶだけでおすすめを表示
- おすすめ3体を総合評価順に表示
- コンボ相性、勝率、メタ評価、難易度を表示
- 初心者おすすめ、オフメタ、データ少ラベルを表示
- 非推奨候補を折りたたみで表示
- Data Dragonからチャンピオン名とアイコンを取得
- CSVを編集して毎パッチのデータ更新が可能
- おすすめ結果をコピーしてチャット等に共有可能
- 選択中の条件をURLで共有可能
- GitHub Issuesからフィードバックを送信可能
- スマホ縦画面とPC横長画面の両方に対応

## 使い方

```bash
pnpm install
pnpm dev
```

ブラウザで `http://127.0.0.1:5173/` を開きます。

## 共有前チェック

友人に共有する前は、以下を実行します。

```bash
pnpm share:check
```

このコマンドは、CSVとJSONの同期、Data Dragon上のチャンピオンID、TypeScript、 production build をまとめて確認します。

## データ更新

データは `data/manual/` のCSVを編集して更新します。

```bash
pnpm validate:csv
pnpm import:data
pnpm check:data
```

詳しい手順は [docs/data-update.md](docs/data-update.md) を参照してください。

## 変更履歴

仕様変更と実装内容は [CHANGELOG.md](CHANGELOG.md) に記録します。

## GitHub Pagesで公開する

このリポジトリには GitHub Pages 用のActions workflowが入っています。公開手順は [docs/share.md](docs/share.md) を参照してください。

## 公開前の状態

- GitHub Pages向けに相対パスでビルドされる設定です
- `pnpm share:check` がGitHub Actions上でも実行されます
- ブラウザタブ用のRiftSyncアイコンとWeb manifestを含みます

## 注意

現在のデータはMVP用のサンプルデータです。実運用前に、U.GG / OP.GG 等を確認して `data/manual/` のCSVを更新してください。

RiftSync is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.
