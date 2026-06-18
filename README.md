# RiftSync

RiftSync は、League of Legends のソロQ向けピック支援Webアプリです。

味方1人のロールとチャンピオンを入力すると、自分のロールで相性の良いおすすめチャンピオンを3体表示します。初心者がチャンピオンセレクト中に短時間で判断できるように、日本語UI、アイコン中心、短い理由表示を重視しています。

## 主な機能

- 味方ロール、味方チャンピオン、自分ロールを選ぶだけでおすすめを表示
- おすすめ3体を総合評価順に表示
- コンボ相性、勝率、メタ評価、難易度、試合数、スコア内訳を表示
- 初心者おすすめ、推定相性、オフメタ、データ少ラベルを表示
- 直接相性データや候補データが少ない場合は注意を表示
- 非推奨候補を折りたたみで表示
- Data Dragonからチャンピオン名とアイコンを取得
- 大きなシナジーデータは別JSONとして読み込み、初期表示用JSを軽量化
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

ロール別の勝率、使用率、Tier相当、サンプル数と、味方チャンピオン別のシナジー上位3件はOP.GGから更新できます。

```bash
pnpm update:opgg
```

このコマンドは `data/manual/roleStats.csv`、`data/manual/pairSynergies.csv`、`data/manual/dataMeta.csv` を更新し、`src/data/` のJSONへ反映します。
ロール別統計だけ更新したい場合は `pnpm update:opgg:stats`、シナジーだけ更新したい場合は `pnpm update:opgg:synergies` を使います。

```bash
pnpm validate:csv
pnpm import:data
pnpm check:data
```

詳しい手順は [docs/data-update.md](docs/data-update.md) を参照してください。

## 変更履歴

仕様変更と実装内容は [CHANGELOG.md](CHANGELOG.md) に記録します。

## 開発メモ

- `src/components/`: 画面部品
- `src/hooks/`: Data Dragonなどの取得処理
- `src/utils/`: 共有URLやクリップボードなどの小さな処理
- `src/scoring.ts`: おすすめ順位とスコア計算
- `src/synergyProfiles.ts`: 相性データが無い場合のチャンピオン性質ベース推定
- `src/roleCatalog.ts`: Data Dragonから取得した全チャンピオンをロール候補へ広げる分類

## GitHub Pagesで公開する

このリポジトリには GitHub Pages 用のActions workflowが入っています。公開手順は [docs/share.md](docs/share.md) を参照してください。

## 公開前の状態

- GitHub Pages向けに相対パスでビルドされる設定です
- `pnpm share:check` がGitHub Actions上でも実行されます
- ブラウザタブ用のRiftSyncアイコンとWeb manifestを含みます

## 注意

現在のロール別データはOP.GG Champion Tier ListのGlobal / Gold+ / Ranked Solo/Duoを元に更新しています。
相性データはOP.GGの個別シナジーページから、味方チャンピオン/味方ロールごとに各自分ロールの上位3件を取り込んでいます。

特に相性精度を上げたい組み合わせは、`data/manual/pairSynergies.csv` に直接相性データを追加するとおすすめ結果へ強く反映されます。ただし `pnpm update:opgg:synergies` を実行するとOP.GG取り込み結果で上書きされます。
同じ味方チャンピオン/味方ロール/自分ロールの直接相性データが3件以上ある場合、おすすめ3体はCSVに書いた順番の上位3件をそのまま表示します。
CSV未登録のチャンピオンも、Data Dragonのタグ/難易度/戦闘プロフィールと `src/roleCatalog.ts` のロール分類から補完候補として表示されます。補完候補は「補完データ」「データ少」ラベルを付け、実データより強いペナルティをかけます。
`pairSynergies.json` はViteの `?url` importで別アセット化し、初期JSへ直接含めない構成です。

RiftSync is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.
