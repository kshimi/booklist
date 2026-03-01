# デプロイガイダンス（GitHub Pages）

書籍カタログアプリを GitHub Pages に公開する手順です。

## 公開URL

```
https://kshimi.github.io/booklist/
```

---

## 初回セットアップ

以下の設定は最初に一度だけ行います。

### 1. Vite の設定変更・GitHub Actions ワークフロー作成

Claude Code に以下のように指示してください。

```
docs/dev/deploy.md の手順に従って GitHub Pages のデプロイ設定を行ってください。
```

Claude Code が以下を行います：

- `vite.config.mjs` にベースパスを追加
- `.github/workflows/deploy.yml`（自動デプロイワークフロー）を作成
- コミットして PR を作成

### 2. リポジトリの GitHub Pages 設定

PR をマージしたあと、GitHub リポジトリの設定を変更します。

1. GitHub リポジトリを開く
2. **Settings > Pages** を開く
3. **Source** を **GitHub Actions** に変更して保存

この設定を行うと、`master` ブランチへの push 時に自動でデプロイが実行されるようになります。

---

## デプロイの確認

GitHub の **Actions** タブを開き、**Deploy to GitHub Pages** ワークフローが正常に完了（緑のチェック）していることを確認します。

完了後に `https://kshimi.github.io/booklist/` を開いて動作を確認してください。

---

## 日常的なデプロイ（書籍データの更新）

書籍データを更新してアプリに反映する手順です。

### 1. CSV の更新

Google Apps Script で最新の CSV を取得して `data/booklist.csv` を差し替えます。

### 2. books.json の再生成

```bash
node scripts/process.js
```

### 3. コミットして push

```bash
git add data/books.json
git commit -m "chore: update books.json"
git push origin master
```

push すると GitHub Actions が自動的にビルドとデプロイを実行します。

---

## 手動デプロイ

コードの変更（機能追加・バグ修正）が `master` にマージされた場合も自動でデプロイされます。

手動で実行したい場合は：

1. GitHub の **Actions** タブを開く
2. **Deploy to GitHub Pages** を選択
3. **Run workflow** → **Run workflow** をクリック

---

## トラブルシューティング

### ページが表示されない / 404 エラー

- GitHub Pages の **Source** が **GitHub Actions** に設定されているか確認してください
- Actions タブでワークフローが正常完了しているか確認してください

### 書籍データが古い

- `data/books.json` の最終更新日を確認し、必要であれば再生成・再 push してください

### PDF リンクが開かない

- Google Drive にログインしているかどうか確認してください
- アプリ自体の問題ではなく、Google Drive のアクセス権限の問題です
