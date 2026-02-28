# コンポーネント設計

**作成日**: 2026-02-28
**ステータス**: ドラフト v0.1
**対象フェーズ**: フェーズ1（静的SPA）

---

> 機能要件は [`docs/app/spec/functional/ui-features.md`](../functional/ui-features.md) を参照。
> 本ドキュメントは実装設計（HOW）を定義する。

## 1. コンポーネント階層

```
App
├── Navigation（タブ切替）
├── BookListPage（S-1 書籍一覧）
│   ├── SearchBar
│   ├── GenreFilter
│   ├── AuthorFilter
│   ├── SortControl
│   ├── ResultSummary
│   ├── BookGrid
│   │   └── BookCard（×N）
│   └── Pagination
├── BookDetailPage（S-2 書籍詳細）
│   ├── BookBasicInfo
│   ├── BookVersionLinks
│   └── BookExternalInfo
│       ├── LoadingSpinner
│       └── ExternalBookDetails
└── StatsDashboardPage（S-3 統計ダッシュボード）
    ├── GenreChart
    └── AuthorRanking
        └── AuthorRankingRow（×N）
```

---

## 2. コンポーネント仕様

### App

| 項目 | 内容 |
|------|------|
| 役割 | アプリ全体のルート。`books.json` を fetch して全コンポーネントに配布する |
| 状態 | `books`（全書籍データ）、`loading`、`error` |
| Props | なし |

**責務**:
- アプリ起動時に `data/books.json` を fetch する
- 全体の状態（フィルタ・ソート・ページ）を管理する
- タブ切替によるページ切り替えを制御する

---

### Navigation

| 項目 | 内容 |
|------|------|
| 役割 | タブ切替UI。S-1 / S-3 を切り替える |
| Props | `activePage`, `onPageChange` |

**タブ定義**:

| タブID | ラベル | 対応ページ |
|--------|--------|----------|
| `list` | 書籍一覧 | S-1 |
| `stats` | 統計 | S-3 |

---

### BookListPage（S-1）

| 項目 | 内容 |
|------|------|
| 役割 | 検索・フィルタ・ソート・ページネーションを統合する書籍一覧ページ |
| Props | `books`（全書籍データ）、`onSelectBook` |

**内部処理**:
1. `books` に対してフィルタ（キーワード・ジャンル・著者）を適用
2. ソートを適用
3. ページネーションで現在ページ分を切り出して `BookGrid` に渡す

---

### SearchBar

| 項目 | 内容 |
|------|------|
| 役割 | キーワード入力フィールド。入力変更をコールバックで通知する |
| Props | `value`, `onChange` |

**仕様**:
- `onChange` はデバウンスなしで即時呼び出す（インクリメンタルサーチ）
- クリアボタンで `value` を空文字にリセットする

---

### GenreFilter

| 項目 | 内容 |
|------|------|
| 役割 | ジャンル選択ボタン群。クリックで絞り込む |
| Props | `genres`（表示するジャンル一覧）、`selectedGenre`, `onSelect` |

**仕様**:
- 「すべて」ボタンを先頭に追加する
- 選択中のジャンルはアクティブスタイルで強調表示する
- `genres` は `books` から動的に生成する（固定値ではなく）

---

### AuthorFilter

| 項目 | 内容 |
|------|------|
| 役割 | 著者名ドロップダウン。選択で絞り込む |
| Props | `authors`（著者名一覧）、`selectedAuthor`, `onSelect` |

**仕様**:
- 先頭に「すべての著者」選択肢を追加する
- 著者名は五十音順でソートして表示する
- 書籍一覧・書籍詳細の著者名クリックでも同等の絞り込みを行う

---

### SortControl

| 項目 | 内容 |
|------|------|
| 役割 | ソートキー・ソート方向の選択UI |
| Props | `sortKey`, `sortOrder`, `onChange` |

**ソートオプション**:

| sortKey | sortOrder | ラベル |
|---------|-----------|--------|
| `title` | `asc` | 書名（五十音順） |
| `author` | `asc` | 著者名（五十音順） |
| `pages` | `asc` | ページ数（少ない順） |
| `pages` | `desc` | ページ数（多い順） |

---

### ResultSummary

| 項目 | 内容 |
|------|------|
| 役割 | 絞り込み件数と表示範囲を表示する（例: `1-50 / 819件`） |
| Props | `totalCount`, `currentPage`, `pageSize` |

---

### BookGrid

| 項目 | 内容 |
|------|------|
| 役割 | `BookCard` のグリッドコンテナ |
| Props | `books`（現在ページの書籍リスト）、`onSelectBook` |

---

### BookCard

| 項目 | 内容 |
|------|------|
| 役割 | 1冊の書籍をカード形式で表示する |
| Props | `book`, `onSelect` |

**表示項目**:

| 項目 | 内容 |
|------|------|
| タイトル | `book.title` |
| 著者名 | `book.author` |
| ジャンル | `book.genre`（バッジ表示） |
| バージョン | `book.versions`（アイコンまたはバッジ） |
| シリーズ名 | `book.series`（存在する場合のみ） |

**インタラクション**:
- カード全体クリック → `onSelect(book)` を呼び出す
- 著者名クリック → 著者絞り込みを行う（イベントのバブリングを停止）

---

### Pagination

| 項目 | 内容 |
|------|------|
| 役割 | ページ切替UI |
| Props | `totalCount`, `pageSize`, `currentPage`, `onPageChange` |

**表示要素**:
- 前ページボタン（1ページ目では非活性）
- ページ番号ボタン群（現在ページ前後2ページ表示）
- 次ページボタン（最終ページでは非活性）

---

### BookDetailPage（S-2）

| 項目 | 内容 |
|------|------|
| 役割 | 選択した書籍の詳細情報ページまたはモーダル |
| Props | `book`, `onBack`, `onSelectAuthor` |

**表示方式**: モーダルまたはオーバーレイで表示する（SPAのため画面遷移はしない）

---

### BookBasicInfo

| 項目 | 内容 |
|------|------|
| 役割 | ファイル名パースから得た基本情報を表示する |
| Props | `book` |

**表示項目**:

| 項目 | データソース | 非存在時 |
|------|------------|---------|
| タイトル | `book.title` | — |
| 著者名 | `book.author`（クリックで著者絞り込み） | — |
| ジャンル | `book.genre` | — |
| シリーズ名 | `book.series` | 非表示 |
| ISBN | `book.isbn` | 「情報なし」 |
| ページ数 | `book.pages` | 「情報なし」 |

---

### BookVersionLinks

| 項目 | 内容 |
|------|------|
| 役割 | 保有バージョンごとの Google Drive リンクボタンを表示する |
| Props | `versions`, `fileUrl`, `fileId` |

**ボタンラベル**:

| バージョン | ラベル |
|-----------|--------|
| `original` | オリジナル版で開く |
| `kindle` | Kindle版で開く |
| `ipad3` | iPad版で開く |

**仕様**:
- 各ボタンクリックで Google Drive の PDF を新しいタブで開く
- `file_url` を使用する（`file_id` からの URL 組み立ても可）

---

### BookExternalInfo

| 項目 | 内容 |
|------|------|
| 役割 | ISBN がある書籍に対して外部書誌APIからデータを取得・表示する |
| Props | `isbn` |

**状態**:
- `status`: `idle` / `loading` / `loaded` / `error` / `not_found`

**表示分岐**:

| status | 表示 |
|--------|------|
| `idle` | ISBNなし → 非表示 |
| `loading` | `LoadingSpinner` |
| `loaded` | `ExternalBookDetails` |
| `not_found` | 「外部書誌情報なし」 |
| `error` | エラーメッセージ |

---

### ExternalBookDetails

| 項目 | 内容 |
|------|------|
| 役割 | APIから取得した書誌情報を表示する |
| Props | `data`（正規化済み書誌データ）、`source`（`openbd` / `google_books`） |

**表示項目**（取得できた項目のみ表示）:

| 項目 | 内容 |
|------|------|
| 表紙画像 | サムネイル画像 |
| 出版社 | テキスト |
| 出版年 | テキスト |
| 内容紹介 | テキスト（長い場合は省略表示） |

---

### StatsDashboardPage（S-3）

| 項目 | 内容 |
|------|------|
| 役割 | 統計ダッシュボードページ |
| Props | `books`（全書籍データ）、`onFilterByGenre`, `onFilterByAuthor` |

---

### GenreChart

| 項目 | 内容 |
|------|------|
| 役割 | ジャンル別冊数の棒グラフまたは円グラフ |
| Props | `genreStats`（ジャンル名と冊数のマップ）、`onSelectGenre` |

**表示内容**:
- 全11ジャンルの冊数と割合（%）
- クリックで S-1 に遷移してジャンルフィルタを適用する

**グラフ実装方針**: SVGの直接描画またはシンプルなチャートライブラリ（recharts等）を使用する

---

### AuthorRanking

| 項目 | 内容 |
|------|------|
| 役割 | 保有冊数上位20名の著者ランキングリスト |
| Props | `authorStats`（著者名・冊数・代表ジャンルのリスト）、`onSelectAuthor` |

---

### AuthorRankingRow

| 項目 | 内容 |
|------|------|
| 役割 | ランキングの1行 |
| Props | `rank`, `author`, `bookCount`, `mainGenre`, `onSelect` |

**表示内容**: 順位、著者名（クリックで著者絞り込み）、保有冊数、代表ジャンル

---

## 3. コンポーネントファイル配置

```
src/
├── App.jsx
├── components/
│   ├── Navigation.jsx
│   ├── SearchBar.jsx
│   ├── GenreFilter.jsx
│   ├── AuthorFilter.jsx
│   ├── SortControl.jsx
│   ├── ResultSummary.jsx
│   ├── BookGrid.jsx
│   ├── BookCard.jsx
│   ├── Pagination.jsx
│   ├── BookBasicInfo.jsx
│   ├── BookVersionLinks.jsx
│   ├── BookExternalInfo.jsx
│   ├── ExternalBookDetails.jsx
│   ├── LoadingSpinner.jsx
│   ├── GenreChart.jsx
│   ├── AuthorRanking.jsx
│   └── AuthorRankingRow.jsx
└── pages/
    ├── BookListPage.jsx
    ├── BookDetailPage.jsx
    └── StatsDashboardPage.jsx
```

---

## 4. 設計上の決定事項

| 決定 | 理由 |
|------|------|
| 書籍詳細はモーダル表示 | URLルーティングが不要な静的SPAとしてシンプルに保つ |
| フィルタ状態は App で一元管理 | S-1 とS-3 の双方向連携（チャートクリック→一覧絞り込み）のため |
| タブ切替で S-1 / S-3 を切り替え | S-2 はモーダルのため、S-1 と S-3 のみナビゲーション対象 |
| グラフはシンプルな実装 | 819件規模の静的データのため、重いライブラリは不要 |
