# Booklist

Google Drive に保存した PDF ファイル名からメタデータを解析し、個人の蔵書カタログを生成・閲覧できるシステムです。

## 概要

約 1,900 件の PDF ファイル名を解析して正規化された蔵書データ（`data/books.json`）を生成し、静的 React SPA で検索・フィルタリング・閲覧を行います。

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | React (SPA) |
| スタイリング | CSS / Tailwind CSS |
| データ | JSON (`data/books.json`) |
| データ処理 | Node.js スクリプト |
| インフラ | 静的ホスティング（バックエンドなし） |

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# 蔵書データの生成（data/booklist.csv → data/books.json）
node scripts/process.js

# 開発サーバーの起動
npm start
```

## データフロー

1. Google Apps Script で Google Drive の PDF ファイル一覧を CSV エクスポート（`data/booklist.csv`）
2. `node scripts/process.js` で CSV を解析し `data/books.json` を生成
3. React SPA が `data/books.json` を読み込んで表示

> `data/books.json` は自動生成ファイルです。手動で編集せず、`process.js` で再生成してください。

## ドキュメント

詳細は [`docs/`](docs/) を参照してください。

| ドキュメント | パス |
|------------|------|
| プロジェクト概要 | `docs/app/overview.md` |
| アーキテクチャ | `docs/app/architecture.md` |
| 要件定義 | `docs/requirements/` |
| 環境構築ガイド | `docs/dev/setup_user_guidance.md` |
| 開発操作ガイド | `docs/dev/workflow_user_guidance.md` |
