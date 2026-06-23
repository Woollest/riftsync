# RiftSync Docs

RiftSync Docs は、RiftSync の仕様、設計、データ更新、デプロイ手順をまとめる開発・運用ドキュメントです。

アプリを使うだけなら、まずは [RiftSyncを開く](https://woollest.github.io/riftsync/) から始めてください。READMEは利用者向け、このドキュメントサイトは仕様や運用を確認する人向けです。

## ドキュメントの使い分け

- Product / Requirements: アプリの目的、対象範囲、画面仕様、データ仕様、MVP範囲
- Developer / Architecture: ファイル構成、データの流れ、推薦ロジックの置き場所
- Developer / Data Update: OP.GG取り込み、CSV、JSON生成、検証手順
- Developer / Deployment: GitHub Pages公開、Actions、共有前チェック

## 公開URL

RiftSyncはGitHub Pagesで、アプリ本体とドキュメントを同じPages成果物に同居させます。

```text
アプリ: https://woollest.github.io/riftsync/
Docs : https://woollest.github.io/riftsync/docs/
```

MkDocsは `dist/docs/` にビルドされるため、アプリ本体の公開パスを上書きしません。
