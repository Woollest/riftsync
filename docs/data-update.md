# RiftSync データ更新手順

RiftSync のおすすめ結果は、`data/manual/` 配下のCSVを編集し、`pnpm import:data` で `src/data/` 配下のJSONへ反映する。

`src/data/` のJSONはアプリが読み込む生成先として扱う。ロール別統計と相性データは `pnpm update:opgg` でOP.GGから更新する。

## 更新対象ファイル

- `data/manual/roleStats.csv` -> `src/data/roleStats.json`
  - 自分のロールごとの候補チャンピオンの勝率、使用率、メタ評価を管理する
- `data/manual/pairSynergies.csv` -> `src/data/pairSynergies.json`
  - 味方チャンピオンとおすすめ候補のコンボ相性を管理する
  - アプリでは `?url` importで別JSONアセットとして読み込み、初期JSには直接含めない
- `data/manual/reasonTemplates.csv` -> `src/data/reasonTemplates.json`
  - おすすめ理由の表示文を管理する
- `data/manual/dataMeta.csv` -> `src/data/dataMeta.json`
  - パッチ、ランク帯、地域、データ出典、仮データかどうかを管理する
- `src/roleCatalog.ts`
  - 味方チャンピオン一覧で「ロールにマッチ」へ上げる分類を管理する

## championId のルール

`championId` はアプリ内のチャンピオンIDを使う。

既存データでは以下のようなIDを使っている。

```text
malphite
jarvanIV
missFortune
leeSin
kaisa
```

新しいチャンピオンを追加する場合、Data DragonのIDをそのまま使ってもよい。  
ただし、既存の手入力データと表記がずれると同じチャンピオンとして扱われないため、できるだけ既存IDに合わせる。

## roleStats.csv

自分が選ぶ候補チャンピオンのロール別データを入れる。

```csv
championId,role,winRate,pickRate,metaScore,sampleSize,tier
ahri,mid,51.6,9.4,86,24180,S
```

項目:

- `championId`: チャンピオンID
- `role`: `top` / `jungle` / `mid` / `adc` / `support`
- `winRate`: 表示用の勝率
- `pickRate`: 使用率。1.0未満ならおすすめカードでオフメタ扱い
- `metaScore`: 0から100のメタ評価。炎マーク表示に使う
- `sampleSize`: 試合数。500未満ならデータ少ラベルを表示
- `tier`: `S` / `A` / `B` / `C` / `D`

## pairSynergies.csv

味方1体と、自分が選ぶ候補チャンピオンの相性データを入れる。

```csv
allyChampionId,allyRole,recommendedChampionId,recommendedRole,comboScore,pairWinRate,sampleSize,reasonType
malphite,top,orianna,mid,94,54.1,1320,teamfight_aoe
```

項目:

- `allyChampionId`: 味方チャンピオンID
- `allyRole`: 味方ロール
- `recommendedChampionId`: 自分におすすめするチャンピオンID
- `recommendedRole`: 自分のロール
- `comboScore`: コンボ相性。0から100
- `pairWinRate`: その組み合わせの勝率
- `sampleSize`: その組み合わせの試合数
- `reasonType`: `reasonTemplates.json` のキー

同じ `allyChampionId` / `allyRole` / `recommendedRole` の直接相性データが3件以上ある場合、アプリのおすすめ3体はCSVに書いた順番の上位3件をそのまま表示する。`pnpm update:opgg:synergies` はOP.GGの個別シナジーページを巡回し、各自分ロールの上位3体をOP.GGの表示順に取り込む。

## データ更新の流れ

1. `pnpm update:opgg` を実行してOP.GGのGlobal / Gold+ / Ranked Solo/Duoのロール別統計とシナジーを取り込む
2. `pnpm check:data` を実行してCSVとJSONの同期、Data Dragon上のID、形式のミスを確認する
3. `pnpm build` を実行して壊れていないか確認する
4. ブラウザでおすすめ3体と非推奨候補が出るか確認する

## CSV反映コマンド

OP.GGのロール別統計とシナジーをまとめて更新してJSONへ反映する場合は、以下を使う。

```bash
pnpm update:opgg
```

このコマンドはOP.GGのChampion Tier Listから `positionWinRate`、`positionPickRate`、Tier、総解析数を取得し、`data/manual/roleStats.csv` と `data/manual/dataMeta.csv` を更新する。続けてOP.GGの個別シナジーページを巡回し、`data/manual/pairSynergies.csv` を更新する。

個別に更新したい場合は以下を使う。

```bash
pnpm update:opgg:stats
pnpm update:opgg:synergies
```

`pnpm update:opgg:synergies` は現在の `roleStats.csv` に載っているチャンピオン/ロールを対象に、`https://op.gg/lol/champions/{champion}/synergies/{role}?region=global&tier=gold_plus&mode=ranked` を取得する。各ページ内の自分ロール別シナジー表から上位3件を取り込み、試合数を `sampleSize`、ペア勝率を `pairWinRate` として保存する。

CSVだけ先に確認したい場合は、以下を使う。

```bash
pnpm validate:csv
```

検証内容:

- CSVのヘッダーが正しい順番・名前になっているか
- 空欄がないか
- ロール名が `top` / `jungle` / `mid` / `adc` / `support` のいずれかか
- Tierが `S` / `A` / `B` / `C` / `D` のいずれかか
- 勝率、使用率、コンボ相性、メタ評価が0から100の範囲か
- `sampleSize` が0以上の整数か
- `reasonType` が `reasonTemplates.csv` に存在するか
- 同じチャンピオン/ロール、同じ相性データが重複していないか
- おすすめ候補に対応する `roleStats.csv` の行が存在しない場合は警告を出す。アプリ側では補完候補として扱う

CSVに問題がなければ、以下でJSONへ反映する。

```bash
pnpm import:data
```

このコマンドは以下を生成する。

- `src/data/roleStats.json`
- `src/data/pairSynergies.json`
- `src/data/reasonTemplates.json`
- `src/data/dataMeta.json`

`src/data/pairSynergies.json` は検証対象でもあり、ビルド時には `assets/pairSynergies-*.json` として出力される。アプリは起動後にこのJSONを読み込み、読み込み中はデータ情報に「読込中」を表示する。

CSVとJSONが同期しているかだけ確認したい場合は、以下を使う。

```bash
pnpm check:data
```

`pnpm check:data` は `pnpm validate:csv` 相当の検証に加えて、Data Dragon上にチャンピオンIDが存在するかも確認する。
エラーはできるだけ `data/manual/*.csv row N` の形で表示する。

## データ検証コマンド

```bash
pnpm validate:data
```

検証内容:

- チャンピオンIDがData Dragon上のチャンピオンと対応しているか
- ロール名が `top` / `jungle` / `mid` / `adc` / `support` のいずれかか
- 勝率、使用率、コンボ相性、メタ評価が0から100の範囲か
- `sampleSize` が0以上の整数か
- `reasonType` が `reasonTemplates.json` に存在するか
- 同じ組み合わせの重複データがないか
- おすすめ候補に対応する `roleStats.json` の行が存在しない場合は警告を出す。アプリ側では補完候補として扱う

## よくあるエラー

- `header must match the expected columns exactly`
  - CSVの列名、列順、余分な列を確認する
- `field "winRate" must be a number`
  - 数値欄に `%` や日本語が入っていないか確認する
- `unknown reasonType`
  - `reasonTemplates.csv` に同じ `reasonType` があるか確認する
- `has no roleStats row`
  - 警告。実データとして扱いたい場合は `roleStats.csv` に行を追加する。未追加のままでも、アプリ側では補完候補として表示できる
- `unknown championId`
  - Data DragonのID、または既存のアプリ内IDと表記がずれていないか確認する

## 注意点

- `pairSynergies.json` にデータがない組み合わせでも、アプリはロール別データから仮のコンボ相性を計算する
- `roleStats.json` に候補が少ないロールでも、Data Dragonと `src/roleCatalog.ts` の分類から補完候補を表示する
- 補完候補は「補完データ」「データ少」ラベルを付け、スコア上も強いデータ不足ペナルティを受ける
- 味方チャンピオン一覧の「ロールにマッチ」は `src/roleCatalog.ts` で管理する
- 味方チャンピオン一覧には全チャンピオンを出し、おすすめ候補は `roleStats.json` の実データを優先しつつ、未登録分を補完候補として広げる
- `pnpm update:opgg:synergies` は `pairSynergies.csv` をOP.GG取り込み結果で上書きするため、手作業の追記を残したい場合は別ファイルに控えてから実行する
- CSV内でカンマを含む文章を入れる場合は `"..."` で囲む
