# 外部API連携設計

**作成日**: 2026-02-28
**ステータス**: ドラフト v0.1
**対象フェーズ**: フェーズ1（静的SPA）

---

> 機能要件は [`docs/app/spec/functional/ui-features.md`](../functional/ui-features.md) F-11 を参照。
> 本ドキュメントは実装設計（HOW）を定義する。

## 1. 概要

書籍詳細画面（S-2）において、ISBNが存在する書籍に対して外部書誌APIから補完情報（表紙・出版社・出版年・内容紹介）を取得する。

| 優先度 | API | 対象 | 認証 |
|--------|-----|------|------|
| 第1優先 | OpenBD API | 日本語書籍 | 不要 |
| フォールバック | Google Books API | OpenBDでデータなしの場合（洋書対応） | 不要（APIキー推奨） |

**呼び出し方針**:
- ISBNが存在する書籍のみAPIを呼び出す
- ISBNが存在しない書籍はAPIを呼び出さず、基本情報のみ表示する
- ブラウザからの直接呼び出し（クライアントサイドfetch）

---

## 2. OpenBD API

### エンドポイント

```
GET https://api.openbd.jp/v1/get?isbn={isbn}
```

### リクエスト仕様

| 項目 | 値 |
|------|---|
| メソッド | GET |
| パラメータ | `isbn`: ISBN-10 または ISBN-13（ハイフンなし） |
| 認証 | 不要 |
| Content-Type | なし（GETリクエスト） |

**リクエスト例**:
```
GET https://api.openbd.jp/v1/get?isbn=9784101020112
```

### レスポンス仕様

```json
[
  {
    "summary": {
      "isbn": "9784101020112",
      "title": "こころ",
      "volume": "",
      "series": "",
      "publisher": "新潮社",
      "pubdate": "20030401",
      "cover": "https://cover.openbd.jp/9784101020112.jpg",
      "author": "夏目漱石"
    },
    "onix": {
      "CollateralDetail": {
        "TextContent": [
          {
            "TextType": "03",
            "Text": "内容紹介テキスト..."
          }
        ]
      }
    }
  }
]
```

**データなし時のレスポンス**:
```json
[null]
```

### 利用フィールド

| 取得先 | フィールドパス | 用途 |
|--------|--------------|------|
| `summary.cover` | 表紙画像URL | 表紙サムネイル表示 |
| `summary.publisher` | 出版社 | 出版社表示 |
| `summary.pubdate` | 出版年月日（YYYYMMDD形式） | 出版年表示（年のみ使用） |
| `onix.CollateralDetail.TextContent[]` | TextType=`"03"` の `Text` | 内容紹介表示 |

### データなし判定

```javascript
function isOpenBDEmpty(response) {
  return !response || response.length === 0 || response[0] === null;
}
```

---

## 3. Google Books API

### エンドポイント

```
GET https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}
```

### リクエスト仕様

| 項目 | 値 |
|------|---|
| メソッド | GET |
| パラメータ | `q`: `isbn:{isbn}` 形式のクエリ |
| 認証 | 不要（APIキーなし）。レート制限に注意 |

**リクエスト例**:
```
GET https://www.googleapis.com/books/v1/volumes?q=isbn:9784101020112
```

### レスポンス仕様

```json
{
  "totalItems": 1,
  "items": [
    {
      "volumeInfo": {
        "title": "こころ",
        "authors": ["夏目漱石"],
        "publisher": "新潮社",
        "publishedDate": "2003-04",
        "description": "内容紹介テキスト...",
        "imageLinks": {
          "thumbnail": "https://books.google.com/books/content?id=..."
        }
      }
    }
  ]
}
```

**データなし時のレスポンス**:
```json
{
  "totalItems": 0
}
```

### 利用フィールド

| 取得先 | フィールドパス | 用途 |
|--------|--------------|------|
| `items[0].volumeInfo.imageLinks.thumbnail` | 表紙画像URL | 表紙サムネイル表示 |
| `items[0].volumeInfo.publisher` | 出版社 | 出版社表示 |
| `items[0].volumeInfo.publishedDate` | 出版年（YYYY-MM または YYYY形式） | 出版年表示 |
| `items[0].volumeInfo.description` | 内容紹介 | 内容紹介表示 |

### データなし判定

```javascript
function isGoogleBooksEmpty(response) {
  return !response || !response.items || response.items.length === 0;
}
```

---

## 4. API呼び出しフロー

```
ISBNあり？
    │
   Yes
    │
    ▼
OpenBD APIを呼び出す
    │
    ├─ データあり → OpenBDのデータを表示 → 終了
    │
    └─ データなし（[null]）またはエラー
          │
          ▼
       Google Books APIを呼び出す
          │
          ├─ データあり → Google BooksのデータをOpenBD形式に正規化して表示 → 終了
          │
          └─ データなし・エラー → 「外部書誌情報なし」を表示 → 終了
```

---

## 5. 正規化インターフェース

両APIのレスポンスを統一インターフェースに正規化して `ExternalBookDetails` コンポーネントに渡す。

### 正規化後のデータ型

```typescript
interface ExternalBookData {
  coverUrl: string | null;    // 表紙画像URL
  publisher: string | null;   // 出版社
  publishedYear: string | null; // 出版年（4桁の年 例: "2003"）
  description: string | null; // 内容紹介
  source: 'openbd' | 'google_books'; // データソース
}
```

### OpenBD データの正規化

```javascript
function normalizeOpenBD(response) {
  const item = response[0];
  if (!item) return null;
  const summary = item.summary ?? {};
  const texts = item.onix?.CollateralDetail?.TextContent ?? [];
  const descEntry = texts.find(t => t.TextType === '03');

  return {
    coverUrl: summary.cover || null,
    publisher: summary.publisher || null,
    publishedYear: summary.pubdate ? summary.pubdate.slice(0, 4) : null,
    description: descEntry?.Text || null,
    source: 'openbd',
  };
}
```

### Google Books データの正規化

```javascript
function normalizeGoogleBooks(response) {
  const volumeInfo = response.items?.[0]?.volumeInfo;
  if (!volumeInfo) return null;

  return {
    coverUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
    publisher: volumeInfo.publisher || null,
    publishedYear: volumeInfo.publishedDate?.slice(0, 4) || null,
    description: volumeInfo.description || null,
    source: 'google_books',
  };
}
```

---

## 6. フック実装

```javascript
// src/hooks/useExternalBookData.js

import { useState, useEffect } from 'react';

export function useExternalBookData(isbn) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | loaded | not_found | error

  useEffect(() => {
    if (!isbn) {
      setStatus('idle');
      return;
    }

    setStatus('loading');
    setData(null);

    fetchOpenBD(isbn)
      .then(result => {
        if (result) {
          setData(result);
          setStatus('loaded');
        } else {
          return fetchGoogleBooks(isbn);
        }
      })
      .then(result => {
        if (result === undefined) return; // OpenBDで解決済み
        if (result) {
          setData(result);
          setStatus('loaded');
        } else {
          setStatus('not_found');
        }
      })
      .catch(() => {
        setStatus('error');
      });
  }, [isbn]);

  return { data, status };
}
```

---

## 7. エラーハンドリング方針

| 状況 | 処理 |
|------|------|
| ネットワークエラー（fetch失敗） | フォールバックAPIを試みる。両方失敗したら `error` 状態を表示する |
| HTTPエラー（4xx / 5xx） | フォールバックAPIを試みる |
| CORSエラー | OpenBD / Google Books はCORS対応済みのため発生しない想定 |
| タイムアウト | 10秒でタイムアウトし、フォールバックへ進む |

---

## 8. キャッシュ方針

同一ISBNのAPIリクエストを繰り返さないため、Reactの状態にキャッシュする。

```javascript
// src/hooks/useExternalBookData.js 内（モジュールスコープのキャッシュ）

const cache = new Map(); // isbn → ExternalBookData | 'not_found'

export function useExternalBookData(isbn) {
  // ...キャッシュを参照してから fetchする
}
```

**方針**:
- キャッシュはモジュールスコープの `Map`（メモリキャッシュ）
- セッション中のみ有効（ページリロードでリセット）
- LocalStorage / SessionStorage は使用しない（APIデータは変わりうるため）

---

## 9. 外部API参考情報

| API | ドキュメント |
|-----|------------|
| OpenBD | https://openbd.jp/ |
| Google Books | https://developers.google.com/books/docs/v1/using |
