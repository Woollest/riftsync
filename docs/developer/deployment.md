# RiftSync デプロイ手順

友人にRiftSyncを共有するための公開前チェックとGitHub Pages公開手順。

## 1. 公開前チェック

まずローカルで以下を実行する。

```bash
pnpm run verify
```

確認される内容:

- CSVと生成JSONが同期しているか
- Data Dragon上にチャンピオンIDが存在するか
- `reasonType` やロール指定にミスがないか
- TypeScriptが通るか
- production build が成功するか
- PWA manifest、アイコン、service workerが揃っているか
- MkDocsのドキュメントサイトが `dist/docs/` にビルドできるか

## 2. GitHubにpushする

`main` ブランチにpushすると、`.github/workflows/ci.yml` と `.github/workflows/deploy.yml` が自動で実行される。

- `ci.yml`: push、pull request、手動実行で検証する
- `deploy.yml`: `main` へのpush後、アプリとDocsのbuildを通してGitHub Pagesへ公開する

```bash
git add .
git commit -m "Prepare RiftSync for sharing"
git push origin main
```

## 3. GitHub Pagesを有効化する

GitHubのリポジトリ画面で以下を設定する。

1. `Settings` を開く
2. `Pages` を開く
3. `Build and deployment` の `Source` を `GitHub Actions` にする
4. `Actions` タブで `Deploy to GitHub Pages` が成功するのを待つ
5. `Settings` -> `Pages` に表示されるURLを友人に共有する

公開URLは通常、以下の形になる。

```text
https://<GitHubユーザー名>.github.io/<リポジトリ名>/
```

RiftSyncでは、アプリ本体とMkDocsを同じPages成果物に同居させる。

```text
アプリ: https://woollest.github.io/riftsync/
Docs : https://woollest.github.io/riftsync/docs/
```

## 4. 共有前に見るところ

- スマホで開いて、ロール選択とチャンピオン一覧が操作できるか
- PC横長画面で、入力欄が左、結果が右に表示されるか
- おすすめ3体が表示されるか
- 「結果をコピー」でおすすめ内容をクリップボードに保存できるか
- 「リンクをコピー」で同じ条件を開けるURLを共有できるか
- 「フィードバック」からGitHub Issuesを開けるか
- 画像が欠けていないか
- データ情報にパッチ、更新日、仮データ表示が出ているか
- 「非推奨候補を見る」が開閉できるか
- `/docs/` でドキュメントサイトが開けるか

## 5. データ更新後の共有

CSVを更新したら、毎回以下を実行してからpushする。

```bash
pnpm validate:csv
pnpm import:data
pnpm run verify
```

`pnpm run verify` が成功してからpushすれば、GitHub Pages側でも同じチェックを通して公開される。

## 6. Docsだけ確認する場合

MkDocsの依存を入れてから、以下で `dist/docs/` にドキュメントサイトをビルドする。

```bash
python -m pip install -r requirements-docs.txt
pnpm run docs:build
```

GitHub Actionsでは、Viteのアプリbuild後にこのコマンドを実行し、`dist/` 全体をPagesへアップロードする。
