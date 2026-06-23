# RiftSync 構成メモ

このドキュメントは開発者向けのファイル構成メモ。

## ディレクトリ

- `src/app/`
  - アプリのルート画面、グローバルCSS、service worker登録
- `src/components/`
  - 画面で再利用するUI部品
- `src/config/`
  - URL、初期選択値、Data Dragonの既定値などの設定
- `src/data/`
  - アプリが読み込む固定データとCSVから生成されたJSON
- `src/domain/`
  - 型、スコア計算、相性推定、ロール分類などのドメインロジック
- `src/hooks/`
  - Data Dragonや相性JSONなど、外部/生成データの読み込み
- `src/utils/`
  - 共有URL、クリップボードなどの小さな補助処理
- `data/manual/`
  - 人が確認・更新するCSVデータ
- `scripts/`
  - OP.GG取り込み、CSV import、データ検証
- `public/`
  - PWA manifest、service worker、favicon、ホーム画面用アイコン
- `docs/developer/`
  - 開発、データ更新、デプロイ手順
- `docs/product/`
  - 要件定義などプロダクト寄りの資料
- `mkdocs.yml`
  - `docs/` 配下をドキュメントサイトとしてビルドするMkDocs設定
- `requirements-docs.txt`
  - MkDocsとテーマのPython依存

## データの流れ

1. `data/manual/*.csv` を更新する
2. `scripts/import-csv-data.mjs` が `src/data/*.json` を生成する
3. アプリは `src/data/roleStats.json` などを直接読み込む
4. 大きい `pairSynergies.json` は `?url` importで別アセット化し、起動後にfetchする

## 判断ロジック

おすすめ順位は `src/domain/scoring.ts` に集約する。UI側ではスコア計算の詳細を持たず、`Recommendation` として整形された結果だけを表示する。

直接相性データが3件以上ある場合は、OP.GGのシナジー表示順を優先する。直接相性が足りない場合は、ロール別統計とチャンピオンのタグ/戦闘プロフィールから推定候補を補う。

## ドキュメントサイト

READMEは利用者向け、`docs/` 配下は開発・運用向けの資料として分ける。

MkDocsはGitHub Pagesのアプリ本体を上書きしないよう、`dist/docs/` にビルドする。

```text
アプリ: dist/
Docs : dist/docs/
```

公開後のURLは以下の形になる。

```text
https://woollest.github.io/riftsync/
https://woollest.github.io/riftsync/docs/
```
