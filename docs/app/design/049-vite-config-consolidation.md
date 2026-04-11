# #49 Vite 設定ファイルの統合

## 概要

PR #46 で追加された `vite.config.js` が Vite v6 のファイル解決順序により `vite.config.mjs` より優先されることで、本番ビルドに必要な設定（`base`、`serveDataPlugin`、`publicDir: false`）が失われ、GitHub Pages でページが表示されなくなっている。

2 つの設定ファイルを 1 つに統合してこの問題を解消する。

## 技術的アプローチ

### 比較表

| 項目 | 案A: `vite.config.js` に統合 | 案B: `vite.config.mjs` に統合 |
|------|------------------------------|-------------------------------|
| 手順 | `.js` に `mjs` の設定を追加し、`mjs` を削除 | `.mjs` に `js` のプラグインを追加し、`js` を削除 |
| 拡張子 | `.js`（ESM 設定を `type:module` 不要で記述可） | `.mjs`（明示的 ESM） |
| Git 差分 | 既存の `vite.config.js` を更新、`vite.config.mjs` を削除 | 既存の `vite.config.mjs` を更新、`vite.config.js` を削除 |
| リスク | 低（`js` は Vite が最優先で読む → 確実） | 低（`mjs` が唯一の設定ファイルになれば問題なし） |

**採用: 案A（`vite.config.js` に統合）**

- `vite.config.js` は Vite が最初に解決するファイルであり、将来的に同種の競合が発生しない
- PR #46 で追加したファイルをベースにするため、差分の意図が明確になる

### 統合後の `vite.config.js`

両ファイルの設定をすべて含む単一ファイルに統合する：

| 設定要素 | 出所 | 内容 |
|----------|------|------|
| `base: '/booklist/'` | `vite.config.mjs` | GitHub Pages のサブパス設定 |
| `publicDir: false` | `vite.config.mjs` | デフォルトの public ディレクトリを無効化 |
| `serveDataPlugin` | `vite.config.mjs` | dev サーバーで `data/` を提供、ビルド時に `dist/data/` へコピー |
| `correctionsPlugin` | `vite.config.js` | dev サーバーで `/api/corrections` エンドポイントを提供 |

## 影響範囲

| 対象 | 変更内容 |
|------|----------|
| `vite.config.js` | `serveDataPlugin`・`base`・`publicDir: false` を追加 |
| `vite.config.mjs` | 削除 |
| `dist/` 生成物 | `base` が正しく反映され、アセットパスが `/booklist/assets/` になる |
| `dist/data/` | `closeBundle` により `books.json` 等がコピーされる |
| ローカル開発 | 変化なし（`npm run dev` は引き続き動作する） |

## テスト計画

1. `npm run build` を実行し、`dist/index.html` のスクリプトパスが `/booklist/assets/` で始まることを確認
2. `dist/data/books.json`、`dist/data/book-metadata.json`、`dist/data/book-ai-comments.json` が存在することを確認
3. `npm run dev` を実行し、ローカル開発サーバーが正常に起動することを確認
4. `/api/corrections` エンドポイントが引き続き動作することを確認（dev サーバー上）
5. GitHub Pages へデプロイし、ページが正常に表示されることを確認
