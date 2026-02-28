# 環境構築ガイダンス

## 前提条件

以下のソフトウェアがインストールされていることを確認してください。

| ソフトウェア | 用途 |
|-------------|------|
| Node.js（LTS） | 開発サーバー・データ処理スクリプト |
| Git | バージョン管理 |
| GitHub CLI (`gh`) | GitHub 操作 |
| Claude Code | AI 開発アシスタント |

また、PDF を閲覧するために **Google Drive へのアクセス権限**が必要です。

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd booklist
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 蔵書データの配置

Google Apps Script で取得した CSV ファイルを以下のパスに配置します。

```
data/booklist.csv
```

CSV の取得方法は別途 Google Apps Script のスクリプトを実行してください。

### 4. 蔵書カタログの生成

以下のコマンドで CSV を解析し、アプリが読み込む `data/books.json` を生成します。

```bash
node scripts/process.js
```

完了後、`data/books.json` に約 819 件のデータが出力されます。

### 5. 環境変数の設定（任意）

Google Books API キーを設定すると、OpenBD で情報が取得できない書籍（主に洋書）の書誌情報補完が改善されます。

プロジェクトルートに `.env` ファイルを作成します。

```
VITE_GOOGLE_BOOKS_API_KEY=your_api_key_here
```

> API キーなしでも動作します（レートリミットがかかる場合があります）。

### 6. 初回セットアップの実行

Claude Code に以下のように指示してセットアップを実行することもできます。

```
docs/dev/setup.md に従って初回セットアップを実行してください
```

## 動作確認

開発サーバーを起動します。

```bash
npm start
```

ブラウザで http://localhost:5173 を開き、書籍一覧が表示されれば成功です。

## トラブルシューティング

### `data/books.json` が生成されない

- `data/booklist.csv` が正しいパスに配置されているか確認してください
- CSV のカラム構成が正しいかを確認してください（詳細は `docs/dev/setup.md` 参照）

### npm install が失敗する

```bash
# node_modules を削除して再インストール
rm -rf node_modules
npm install
```

### 開発サーバーが起動しない

Node.js のバージョンを確認してください。LTS バージョンを推奨します。

```bash
node -v
```

### 書籍詳細で PDF が開かない

Google Drive にアクセスできる状態かどうか確認してください。ブラウザで Google Drive を開き、ログイン済みであることを確認してください。
