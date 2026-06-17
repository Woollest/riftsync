# RiftSync データ更新手順

RiftSync のおすすめ結果は、`data/manual/` 配下のCSVを編集し、`pnpm import:data` で `src/data/` 配下のJSONへ反映する。

`src/data/` のJSONはアプリが読み込む生成先として扱う。毎パッチ更新では、基本的にCSVを編集する。

## 更新対象ファイル

- `data/manual/roleStats.csv` -> `src/data/roleStats.json`
  - 自分のロールごとの候補チャンピオンの勝率、使用率、メタ評価を管理する
- `data/manual/pairSynergies.csv` -> `src/data/pairSynergies.json`
  - 味方チャンピオンとおすすめ候補のコンボ相性を管理する
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

同じ `allyChampionId` / `allyRole` / `recommendedRole` の直接相性データが3件以上ある場合、アプリのおすすめ3体はCSVに書いた順番の上位3件をそのまま表示する。OP.GGのシナジー欄を採用する場合は、OP.GG上の上位3体を同じ順番でCSVへ転記する。

## データ更新の流れ

1. 最新パッチを確認する
2. U.GG / OP.GG で Gold+ のロール別データを見る
3. `data/manual/roleStats.csv` に勝率、使用率、Tier相当、試合数を入れる
4. 味方チャンピオンとの相性データを確認できる場合は `data/manual/pairSynergies.csv` に入れる。OP.GGのシナジー欄を使う場合は、上位3体を表示順のまま入れる
5. 相性理由は既存の `reasonType` から近いものを選ぶ
6. `data/manual/dataMeta.csv` のパッチ、出典、更新日を更新する
7. `pnpm validate:csv` を実行してCSVの列名、空欄、重複、参照ミスを確認する
8. `pnpm import:data` を実行してCSVをJSONへ反映する
9. `pnpm check:data` を実行してCSVとJSONの同期、Data Dragon上のID、形式のミスを確認する
10. `pnpm build` を実行して壊れていないか確認する
11. ブラウザでおすすめ3体と非推奨候補が出るか確認する

## CSV反映コマンド

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
- おすすめ候補に対応する `roleStats.csv` の行が存在するか

CSVに問題がなければ、以下でJSONへ反映する。

```bash
pnpm import:data
```

このコマンドは以下を生成する。

- `src/data/roleStats.json`
- `src/data/pairSynergies.json`
- `src/data/reasonTemplates.json`
- `src/data/dataMeta.json`

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
- おすすめ候補に対応する `roleStats.json` の行が存在するか

## よくあるエラー

- `header must match the expected columns exactly`
  - CSVの列名、列順、余分な列を確認する
- `field "winRate" must be a number`
  - 数値欄に `%` や日本語が入っていないか確認する
- `unknown reasonType`
  - `reasonTemplates.csv` に同じ `reasonType` があるか確認する
- `has no roleStats row`
  - `pairSynergies.csv` のおすすめチャンピオンとロールが `roleStats.csv` に存在するか確認する
- `unknown championId`
  - Data DragonのID、または既存のアプリ内IDと表記がずれていないか確認する

## 注意点

- `pairSynergies.json` にデータがない組み合わせでも、アプリはロール別データから仮のコンボ相性を計算する
- `roleStats.json` に候補が少ないロールは、おすすめ結果の幅も狭くなる
- 味方チャンピオン一覧の「ロールにマッチ」は `src/roleCatalog.ts` で管理する
- 味方チャンピオン一覧には全チャンピオンを出すが、おすすめ候補は `roleStats.json` にあるチャンピオンから選ばれる
- CSV内でカンマを含む文章を入れる場合は `"..."` で囲む
