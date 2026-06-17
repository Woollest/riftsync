# RiftSync 共有手順

友人にRiftSyncを共有するための公開前チェックとGitHub Pages公開手順。

## 1. 公開前チェック

まずローカルで以下を実行する。

```bash
pnpm share:check
```

確認される内容:

- CSVと生成JSONが同期しているか
- Data Dragon上にチャンピオンIDが存在するか
- `reasonType` やロール指定にミスがないか
- TypeScriptが通るか
- production build が成功するか

## 2. GitHubにpushする

`main` ブランチにpushすると、`.github/workflows/deploy.yml` が自動で実行される。

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

## 4. 共有前に見るところ

- スマホで開いて、ロール選択とチャンピオン一覧が操作できるか
- PC横長画面で、入力欄が左、結果が右に表示されるか
- おすすめ3体が表示されるか
- 「結果をコピー」でおすすめ内容をクリップボードに保存できるか
- 「フィードバック」からGitHub Issuesを開けるか
- 画像が欠けていないか
- データ情報にパッチ、更新日、仮データ表示が出ているか
- 「非推奨候補を見る」が開閉できるか

## 5. データ更新後の共有

CSVを更新したら、毎回以下を実行してからpushする。

```bash
pnpm validate:csv
pnpm import:data
pnpm share:check
```

`share:check` が成功してからpushすれば、GitHub Pages側でも同じチェックを通して公開される。
