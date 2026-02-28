# 設計ドキュメント 003: UI機能実装

**Issue**: #5 ユーザー向けUI機能の実装
**作成日**: 2026-02-28
**ステータス**: 承認済み

---

## 概要

機能仕様書（`docs/app/spec/functional/ui-features.md`）・コンポーネント設計（`docs/app/spec/system/component-design.md`）・状態管理設計・外部API連携設計に基づき、フロントエンド SPA を新規実装する。

現在 `src/` ディレクトリは存在しない。本 Issue でゼロからフロントエンドを構築する。

### 実装対象機能

| 画面 | 機能ID | 機能名 |
|------|--------|--------|
| S-1 書籍一覧 | F-5 | キーワード検索 |
| S-1 書籍一覧 | F-6 | ジャンルフィルタ（2階層） |
| S-1 書籍一覧 | F-7 | 著者絞り込み |
| S-1 書籍一覧 | F-8 | ソート |
| S-1 書籍一覧 | F-9 | ページネーション |
| S-2 書籍詳細 | F-10 | 基本情報表示 |
| S-2 書籍詳細 | F-11 | 外部書誌API補完表示 |
| S-3 統計 | F-12 | ジャンル別統計 |
| S-3 統計 | F-13 | 著者別ランキング |

---

## 技術的アプローチ

### ビルドツール選定

既存の `package.json` には React 依存関係・ビルドツールが存在しないため、新規に設定する。

#### 比較表

| | **Vite + React（推奨）** | Create React App |
|--|------|------|
| **概要** | 現在主流の高速ビルドツール | 旧来の公式スターターキット |
| **起動速度** | 高速（ESM ネイティブ） | 遅い |
| **メンテナンス状況** | 活発 | 非推奨（2024年以降メンテナンス終了） |
| **設定の複雑さ** | 低（ゼロコンフィグで動作） | 低 |
| **静的ホスティング** | `vite build` で `dist/` を生成 | `react-scripts build` で `build/` を生成 |
| **推奨** | **推奨** | — |

**採用**: Vite + React

---

### スタイリング選定

現在のアーキテクチャドキュメントでは「CSS / Tailwind CSS（TBD）」。

#### 比較表

| | **Tailwind CSS（推奨）** | 素の CSS |
|--|------|------|
| **概要** | ユーティリティファーストのCSSフレームワーク | カスタムCSSを手書き |
| **開発速度** | 高い（クラス名で即スタイル適用） | 低い（CSS設計から必要） |
| **一貫性** | デザイントークンで自動的に統一 | 設計次第 |
| **ビルドサイズ** | 使用クラスのみ抽出（Purge済みで小さい） | 書いた分だけ |
| **個人プロジェクト向け** | 高い（素早くUIを組める） | 高い（依存関係なし） |
| **既存コードへの影響** | `tailwind.config.js` と `postcss.config.js` が必要 | 不要 |
| **推奨** | **推奨** | — |

**採用**: Tailwind CSS（確定）

---

### 実装方針

設計ドキュメント群がすでに詳細に定義されているため、設計に忠実に実装する。

- コンポーネント設計: `docs/app/spec/system/component-design.md`
- 状態管理: `docs/app/spec/system/state-management.md`
- 外部API連携: `docs/app/spec/system/api-integration.md`

#### 実装フェーズ

全機能を1 Issue で実装するが、以下の順序で進める。

| フェーズ | 対象 | 理由 |
|---------|------|------|
| フェーズA | プロジェクトセットアップ・App・Navigation・データ取得 | 基盤となる土台 |
| フェーズB | S-1 書籍一覧（F-5〜F-9） | コアユースケース・最優先 |
| フェーズC | S-2 書籍詳細（F-10〜F-11） | S-1 で書籍選択が必要 |
| フェーズD | S-3 統計ダッシュボード（F-12〜F-13） | 独立して実装可能 |

---

## 影響範囲

### 新規作成ファイル

#### プロジェクト設定

| ファイル | 内容 |
|---------|------|
| `vite.config.js` | Vite 設定 |
| `tailwind.config.js` | Tailwind CSS 設定（採用する場合） |
| `postcss.config.js` | PostCSS 設定（Tailwind を使う場合） |
| `index.html` | SPA エントリーポイント |

#### ソースコード

| ファイル | 対応コンポーネント |
|---------|----------------|
| `src/main.jsx` | エントリーポイント |
| `src/App.jsx` | ルートコンポーネント・データ取得・状態管理 |
| `src/constants.js` | 定数（`PAGE_SIZE`・`SORT_OPTIONS`・`GENRES`・`VERSION_LABELS`） |
| `src/hooks/useBooks.js` | `books.json` フェッチフック |
| `src/hooks/useExternalBookData.js` | 外部書誌APIフェッチフック |
| `src/utils/filter.js` | キーワードフィルタ関数 |
| `src/utils/sort.js` | ソート比較関数 |
| `src/utils/stats.js` | 統計計算関数 |
| `src/components/Navigation.jsx` | タブ切替 |
| `src/components/SearchBar.jsx` | キーワード検索入力 |
| `src/components/GenreFilter.jsx` | ジャンルフィルタ（2階層） |
| `src/components/AuthorFilter.jsx` | 著者絞り込みドロップダウン |
| `src/components/SortControl.jsx` | ソート選択 |
| `src/components/ResultSummary.jsx` | 件数・ページ表示 |
| `src/components/BookGrid.jsx` | 書籍カードグリッド |
| `src/components/BookCard.jsx` | 書籍カード1枚 |
| `src/components/Pagination.jsx` | ページネーション |
| `src/components/BookBasicInfo.jsx` | 書籍基本情報 |
| `src/components/BookVersionLinks.jsx` | Google Drive リンクボタン群 |
| `src/components/BookExternalInfo.jsx` | 外部書誌API情報（ローディング・エラー管理） |
| `src/components/ExternalBookDetails.jsx` | 外部書誌情報表示 |
| `src/components/LoadingSpinner.jsx` | ローディングインジケータ |
| `src/components/GenreChart.jsx` | ジャンル別統計グラフ |
| `src/components/AuthorRanking.jsx` | 著者別ランキング |
| `src/components/AuthorRankingRow.jsx` | ランキング1行 |
| `src/pages/BookListPage.jsx` | 書籍一覧ページ（S-1） |
| `src/pages/BookDetailPage.jsx` | 書籍詳細モーダル（S-2） |
| `src/pages/StatsDashboardPage.jsx` | 統計ダッシュボード（S-3） |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `package.json` | React・Vite・Tailwind CSS の依存関係を追加 |

### 変更なし

| ファイル | 理由 |
|---------|------|
| `data/books.json` | 参照のみ |
| `scripts/process.js` | 変更なし |
| `docs/` | 仕様確定後に必要に応じて更新 |

---

## テスト計画

### 動作確認（手動）

| 確認項目 | 確認内容 |
|---------|---------|
| データ読み込み | `books.json` を正常にフェッチし、書籍一覧が表示されること |
| キーワード検索 | 入力に応じてリアルタイムで絞り込まれること。AND検索・部分一致・大文字小文字無視が動作すること |
| ジャンルフィルタ | 大ジャンル選択でサブジャンルが表示される2階層フィルタが動作すること |
| 著者絞り込み | ドロップダウン選択・著者名クリックで絞り込まれること |
| ソート | 書名・著者名（五十音順）・ページ数（昇降順）で正しくソートされること |
| ページネーション | 50件/ページで表示。フィルタ変更時に1ページ目に戻ること |
| 書籍詳細 | カードクリックでモーダルが開き、基本情報が表示されること |
| Google Drive リンク | バージョンごとのリンクボタンが表示され、新しいタブで開くこと |
| 外部書誌API | ISBNがある書籍で外部情報が取得・表示されること。ISBNなし書籍では呼び出されないこと |
| 統計グラフ | ジャンル別冊数グラフが表示され、クリックで書籍一覧絞り込みに遷移すること |
| 著者ランキング | 上位20名が冊数順に表示され、クリックで書籍一覧絞り込みに遷移すること |
| S-3 → S-1 連携 | グラフ・ランキングのクリックで S-1 に切り替わり、フィルタが適用されること |

### ビルド確認

| 確認項目 | 確認内容 |
|---------|---------|
| `npm run build` | エラーなくビルドが完了すること |
| 静的ファイル配信 | ビルド成果物を静的サーバーで配信し、アプリが正常に動作すること |

---

## 決定事項（確定済み）

| 項目 | 決定内容 |
|------|---------|
| スタイリング方針 | Tailwind CSS を採用 |
| GenreChart の実装 | recharts を採用。実装が複雑になる場合は再考する |
| `subgenre` フィルタの状態管理 | `selectedGenre`（大ジャンル）と `selectedSubgenre`（サブジャンル）を独立した状態として持つ |
