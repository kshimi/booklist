# 状態管理設計

**作成日**: 2026-02-28
**ステータス**: ドラフト v0.1
**対象フェーズ**: フェーズ1（静的SPA）

---

> 機能要件は [`docs/app/spec/functional/ui-features.md`](../functional/ui-features.md) を参照。
> 本ドキュメントは実装設計（HOW）を定義する。

## 1. 方針

819件の静的データを扱うシンプルな SPA のため、Redux 等の外部状態管理ライブラリは使用しない。
React の `useState` / `useReducer` のみで管理する。

全体のフィルタ・ソート・ページ状態は `App` または `BookListPage` で一元管理し、S-3（統計ダッシュボード）からのフィルタ操作（グラフクリック → 書籍一覧絞り込み）も同じ状態を経由する。

---

## 2. 状態定義

### データ状態（App レベル）

| 状態名 | 型 | 初期値 | 説明 |
|--------|-----|--------|------|
| `books` | `Book[]` | `[]` | `data/books.json` から取得した全書籍データ |
| `booksLoading` | boolean | `true` | books.json フェッチ中フラグ |
| `booksError` | string \| null | `null` | フェッチエラーメッセージ |

### ナビゲーション状態（App レベル）

| 状態名 | 型 | 初期値 | 説明 |
|--------|-----|--------|------|
| `activePage` | `'list'` \| `'stats'` | `'list'` | 現在表示中のページ（S-1 / S-3） |
| `selectedBook` | `Book` \| null | `null` | 書籍詳細モーダルで表示する書籍（S-2） |

### フィルタ・ソート・ページ状態（BookListPage レベル）

| 状態名 | 型 | 初期値 | 説明 |
|--------|-----|--------|------|
| `keyword` | string | `''` | キーワード検索入力値 |
| `selectedGenre` | string \| null | `null` | 選択中のジャンル。`null` は「すべて」 |
| `selectedAuthor` | string \| null | `null` | 選択中の著者名。`null` は「すべて」 |
| `sortKey` | `'title'` \| `'author'` \| `'pages'` | `'title'` | ソートキー |
| `sortOrder` | `'asc'` \| `'desc'` | `'asc'` | ソート方向 |
| `currentPage` | number | `1` | 現在のページ番号（1始まり） |

---

## 3. 派生値（useMemo で計算）

フィルタ・ソート・ページネーションの結果は状態ではなく、状態から都度計算する派生値として扱う。

```javascript
// フィルタリング済み書籍リスト
const filteredBooks = useMemo(() => {
  return books
    .filter(book => matchKeyword(book, keyword))
    .filter(book => !selectedGenre || book.genre === selectedGenre)
    .filter(book => !selectedAuthor || book.author === selectedAuthor);
}, [books, keyword, selectedGenre, selectedAuthor]);

// ソート済み書籍リスト
const sortedBooks = useMemo(() => {
  return [...filteredBooks].sort(compareBooks(sortKey, sortOrder));
}, [filteredBooks, sortKey, sortOrder]);

// 現在ページの書籍リスト
const pagedBooks = useMemo(() => {
  const start = (currentPage - 1) * PAGE_SIZE;
  return sortedBooks.slice(start, start + PAGE_SIZE);
}, [sortedBooks, currentPage]);

// 総件数
const totalCount = filteredBooks.length;
```

---

## 4. 状態変更のトリガーと処理

### キーワード検索

| トリガー | 処理 |
|---------|------|
| SearchBar の入力変更 | `keyword` を更新、`currentPage` を `1` にリセット |
| クリアボタンクリック | `keyword` を `''` に更新、`currentPage` を `1` にリセット |

### ジャンルフィルタ

| トリガー | 処理 |
|---------|------|
| GenreFilter のボタンクリック | `selectedGenre` を更新、`currentPage` を `1` にリセット |
| 「すべて」クリック | `selectedGenre` を `null` に更新 |
| GenreChart（S-3）のジャンルクリック | `selectedGenre` を更新、`activePage` を `'list'` に切り替え、`currentPage` を `1` にリセット |

### 著者絞り込み

| トリガー | 処理 |
|---------|------|
| AuthorFilter の選択変更 | `selectedAuthor` を更新、`currentPage` を `1` にリセット |
| BookCard / BookBasicInfo の著者名クリック | `selectedAuthor` を更新、`currentPage` を `1` にリセット、`selectedBook` を `null` に（詳細モーダルを閉じる） |
| AuthorRanking（S-3）の著者名クリック | `selectedAuthor` を更新、`activePage` を `'list'` に切り替え、`currentPage` を `1` にリセット |

### ソート

| トリガー | 処理 |
|---------|------|
| SortControl の変更 | `sortKey` / `sortOrder` を更新、`currentPage` を `1` にリセット |

### ページネーション

| トリガー | 処理 |
|---------|------|
| Pagination のページ切替 | `currentPage` を更新 |

### 書籍詳細（モーダル）

| トリガー | 処理 |
|---------|------|
| BookCard クリック | `selectedBook` を該当書籍に更新 |
| モーダルの閉じるボタン | `selectedBook` を `null` に更新 |
| モーダル背景クリック | `selectedBook` を `null` に更新 |

### ページ切替（タブ）

| トリガー | 処理 |
|---------|------|
| Navigation のタブクリック | `activePage` を更新 |

---

## 5. 定数定義

```javascript
// src/constants.js

export const PAGE_SIZE = 50;

export const SORT_OPTIONS = [
  { key: 'title',  order: 'asc',  label: '書名（五十音順）' },
  { key: 'author', order: 'asc',  label: '著者名（五十音順）' },
  { key: 'pages',  order: 'asc',  label: 'ページ数（少ない順）' },
  { key: 'pages',  order: 'desc', label: 'ページ数（多い順）' },
];

export const GENRES = [
  'SF',
  'フィクション（日本）',
  'エッセイ',
  'ノンフィクション',
  'コンピュータ',
  '運転',
  '実用',
  '家庭',
  '漫画・コミック',
  'フィクション',
  '未分類',
];

export const VERSION_LABELS = {
  original: 'オリジナル版',
  kindle: 'Kindle版',
  ipad3: 'iPad版',
};
```

---

## 6. ユーティリティ関数

```javascript
// src/utils/filter.js

/** キーワードによる書籍マッチ（AND検索、部分一致、大文字小文字無視） */
export function matchKeyword(book, keyword) {
  if (!keyword.trim()) return true;
  const words = keyword.toLowerCase().split(/\s+/);
  const target = `${book.title} ${book.author}`.toLowerCase();
  return words.every(word => target.includes(word));
}

// src/utils/sort.js

/** ソートキーと方向に基づく比較関数を返す */
export function compareBooks(sortKey, sortOrder) {
  return (a, b) => {
    let result = 0;
    if (sortKey === 'pages') {
      result = (a.pages ?? 0) - (b.pages ?? 0);
    } else {
      result = (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '', 'ja');
    }
    return sortOrder === 'desc' ? -result : result;
  };
}

// src/utils/stats.js

/** ジャンル別冊数を計算する */
export function calcGenreStats(books) {
  return books.reduce((acc, book) => {
    acc[book.genre] = (acc[book.genre] ?? 0) + 1;
    return acc;
  }, {});
}

/** 著者別冊数ランキングを計算する（上位N名） */
export function calcAuthorRanking(books, topN = 20) {
  const counts = books.reduce((acc, book) => {
    if (!acc[book.author]) acc[book.author] = { count: 0, genres: {} };
    acc[book.author].count += 1;
    acc[book.author].genres[book.genre] = (acc[book.author].genres[book.genre] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([author, { count, genres }]) => ({
      author,
      bookCount: count,
      mainGenre: Object.entries(genres).sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.bookCount - a.bookCount)
    .slice(0, topN);
}
```

---

## 7. データ取得（books.json fetch）

```javascript
// src/hooks/useBooks.js

import { useState, useEffect } from 'react';

export function useBooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('./data/books.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setBooks(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { books, loading, error };
}
```

**仕様**:
- アプリ起動時に1回だけ fetch する
- エラー時はエラーメッセージを画面に表示してアプリを使用不可にする（データなしでは動作しない）
- `fetch` のパスは `./data/books.json`（相対パス）。静的ファイル配信を前提とする
