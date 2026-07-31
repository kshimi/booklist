# PROJECT_STATE.md

**最終更新**: 2026-04-11
**目的**: Web チャット (claude.ai) での要件相談・機能検討時に、プロジェクトの現状を把握するためのコンテキスト文書。Claude Code への引き継ぎ時の中継物としても使用する。

---

## プロジェクト概要

個人の蔵書管理システム。Google Drive に保存した約 1,900 件のスキャン PDF、紙書籍リスト、Kindle 購入履歴の 3 ソースから書誌メタデータを抽出・統合し、検索・閲覧できる静的 React SPA を提供する。

- **個人利用専用**（パブリックアクセス不要）
- **バックエンドなし**（静的 SPA + ビルド前工程の Node.js スクリプト）
- **GitHub Pages でホスティング**: https://kshimi.github.io/booklist/
- **CI/CD**: master push で GitHub Actions が自動デプロイ

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | React 18 + Vite 6 |
| スタイリング | Tailwind CSS 3 |
| グラフ描画 | Recharts |
| データ処理 | Node.js スクリプト群 (scripts/) |
| 外部 API (ビルド前) | openBD, NDL Search, Google Books, Gemini API |
| テスト | Node.js 組み込み test runner (`node --test`) |
| ホスティング | GitHub Pages (GitHub Actions でビルド・デプロイ) |

---

## データソースと処理パイプライン

3 つの入力ソースを `process.js` で統合し、1 つの `books.json` を生成する。

```
入力ソース                          処理スクリプト              出力
─────────────────────────────────────────────────────────────────────
data/booklist.csv (Google Drive)  ─┐
data/offline_bibliography_list.csv ├─ node scripts/process.js ──→ data/books.json
data/kindle-books.json            ─┘
  ↑
  data/kindle-list.csv ──→ node scripts/parse-kindle-list.js

data/books.json ──→ node scripts/enrich.js ──→ data/book-metadata.json
data/books.json ──→ bash scripts/generate-ai-comments.sh ──→ data/book-ai-comments.json
                   (GEMINI_API_KEY は 1Password から op run で注入)
```

### 補助データファイル

| ファイル | 用途 |
|---------|------|
| `data/author-aliases.json` | 著者名の表記揺れを統一するエイリアステーブル |
| `data/book-corrections.json` | UI から手動入力された書誌補正データ（著者名、ジャンル等） |

---

## 蔵書データの現況

| 項目 | 値 | 備考 |
|------|---|------|
| 総書籍数 | 1,178 冊 | 重複排除後 |
| Google Drive PDF | 819 冊 | 当初からのメインソース |
| 紙書籍 | 56 冊 | offline_bibliography_list.csv 由来 |
| Kindle 書籍 | 303 冊 | Amazon 注文履歴由来 |
| ユニーク著者数 | 366+ | Kindle 分は大半が未設定 |
| ジャンル数 | 11 | SF, フィクション(日本), エッセイ, ノンフィクション, コンピュータ, 運転, 実用, 家庭, 漫画・コミック, フィクション, 未分類 |
| 著者名未設定 | 321 冊 | うち 303 冊が Kindle（100%） |
| ジャンル「未分類」 | 318 冊 | 主に Kindle 書籍 |

---

## SPA の主要機能

### 実装済み

| 機能 | 概要 |
|------|------|
| 書籍一覧 | キーワード検索（インクリメンタル）、ジャンルフィルタ、著者絞り込み、ソート、ページネーション (50件/ページ) |
| 書籍詳細モーダル | 基本情報、Google Drive / Amazon リンク、外部書誌情報（表紙・出版社・内容紹介）、source バッジ (PDF/紙/Kindle) |
| 統計ダッシュボード | ジャンル別分布グラフ（クリックで一覧にフィルタ連動）、著者別保有冊数ランキング上位20名（クリックで著者絞り込み連動） |
| 日替わりサジェスチョン | 日付ベースの決定論的選出 + Gemini 生成の AI おすすめコメント |
| 書誌情報手動編集 | 開発サーバー上で著者名・ジャンル・サブジャンルを手動入力し book-corrections.json に保存 (Vite ミドルウェア経由) |

### 主要コンポーネント構成

```
App.jsx
├── DailySuggestion          日替わりおすすめ
├── Navigation               一覧 / 統計 切り替え
├── BookListPage              書籍一覧ページ
│   ├── SearchBar             キーワード検索
│   ├── GenreFilter           ジャンルフィルタ
│   ├── AuthorFilter          著者絞り込み
│   ├── SortControl           ソート切り替え
│   ├── ResultSummary         検索結果件数表示
│   ├── BookGrid              書籍カードグリッド
│   │   └── BookCard          個別書籍カード
│   └── Pagination            ページネーション
├── StatsDashboardPage        統計ダッシュボード
│   ├── GenreChart            ジャンル分布グラフ
│   └── AuthorRanking         著者ランキング
│       └── AuthorRankingRow  ランキング行
└── BookDetailPage (モーダル)  書籍詳細
    ├── BookBasicInfo          基本情報表示
    ├── BookVersionLinks       バージョンリンク
    ├── BookExternalInfo       外部書誌情報
    ├── ExternalBookDetails    ランタイム外部API取得
    └── BookEditForm           書誌情報手動編集フォーム
```

### ルーティング

React Router は使用していない。`App.jsx` の `activePage` state で `list` / `stats` を切り替え、書籍詳細はモーダルとして表示。

---

## 最近の開発状況

> 進捗・作業計画の正本は [docs/roadmap.md](docs/roadmap.md) に移設しました。
> 直近の Issue・現在地・作業単位はそちらを参照してください。
> Issue 化されていない既知の課題・優先度メモは [docs/app/backlog.md](docs/app/backlog.md) にあります。

---

## 設計上の重要な判断と理由

| 判断 | 理由 |
|------|------|
| 静的 SPA（バックエンドなし） | 個人利用なので運用コスト最小化を優先。フェーズ2 で必要になれば追加 |
| ビルド前工程でジャンル推定 | ランタイムで AI API を呼ぶとコスト・レイテンシが問題。CSV 処理時に一括で推定 |
| books.json は自動生成 | 手動編集すると process.js 再実行時に上書きされる。手動補正は book-corrections.json に分離 |
| enrich.js / generate-ai-comments.js を手動実行 | API 呼び出しにコスト・レート制限がある。差分取得で未取得分のみ処理 |
| React Router 未使用 | ページ数が少なく(一覧・統計の 2 ページ + 詳細モーダル)、導入の複雑さに見合わない |
| Gemini API (AI コメント生成) | Anthropic API ではなく Gemini を使用。無料枠での運用を考慮 |
| book-corrections.json による手動補正 | process.js のパース結果を直接修正せず、補正レイヤーとして分離。再処理時も補正が保持される |

---

## フェーズ構成とスコープ

> フェーズ構成と進捗は正本 [docs/roadmap.md](docs/roadmap.md) を参照してください。
> Issue 化前の将来機能構想（フェーズ 2）は [docs/app/backlog.md](docs/app/backlog.md) にあります。

---

## 開発ワークフロー

- **Issue 駆動**: すべての作業は GitHub Issue に紐づく
- **設計書先行**: `docs/app/design/XXX-*.md` に設計書を作成してから実装
- **テストあり**: `scripts/*.test.js` で Node.js 組み込み test runner を使用
- **ブランチ戦略**: master ブランチに直接 push（個人プロジェクト）
- **言語方針**: コード・CLAUDE.md・コミットメッセージは英語、ドキュメント (docs/app/, docs/requirements/) は日本語

---

## ファイル構成の要点

Web チャットで特定のファイルの内容を議論したい場合は、以下を参照先として指定するとよい。

| 目的 | 参照すべきファイル |
|------|-------------------|
| プロジェクト全体の理解 | この文書 (PROJECT_STATE.md) |
| Claude Code への指示体系 | CLAUDE.md |
| アーキテクチャ詳細・スキーマ定義 | docs/app/architecture.md |
| 要件定義 | docs/requirements/要件定義.md |
| 機能仕様 | docs/app/spec/functional/*.md |
| 個別機能の設計経緯 | docs/app/design/XXX-*.md |
| デプロイ手順 | docs/dev/deploy.md |
