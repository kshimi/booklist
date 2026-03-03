# 設計ドキュメント 020: 書誌情報の事前取得・充実化

**Issue:** #20 書籍詳細の外部書誌情報を充実させたい
**作成日:** 2026-03-03
**ステータス:** ドラフト

---

## 概要

書籍詳細画面（S-2）に表示する外部書誌情報を充実させる。
現状はブラウザのランタイムAPIコールのみで取得しているが、
**ビルド時事前取得（アプローチB）を主軸**とし、
**ランタイム取得（アプローチA）を補完的なフォールバック**として組み合わせる実装に改修する。

---

## 現状の実装

| コンポーネント・ファイル | 役割 |
|------------------------|------|
| `src/hooks/useExternalBookData.js` | ISBNを受け取りopenBD → Google Booksの順でランタイムAPIコール |
| `src/components/BookExternalInfo.jsx` | ローディング状態の制御・表示切り替え |
| `src/components/ExternalBookDetails.jsx` | 書影・出版社・出版年・内容紹介を表示 |
| `src/pages/BookDetailPage.jsx` | `<BookExternalInfo isbn={book.isbn} />` を呼び出す |

**現状で取得・表示できるデータ:**

| フィールド | 取得元 |
|-----------|--------|
| `coverUrl` | openBD / Google Books |
| `publisher` | openBD / Google Books |
| `publishedYear` | openBD / Google Books |
| `description` | openBD / Google Books |

**現状の課題:**

- 書籍詳細を開くたびに外部APIコールが発生し、表示に待機時間が生じる
- ISBNは `books.json` にISBN-10形式で保存されているが、openBDはISBN-13を要求する（現状はISBN-10のまま渡しているためopenBDでヒットしないケースが多い可能性がある）
- CORS非対応のNDL Searchやレート制限の厳しいAPIは利用できない

---

## 設計方針

```
【ビルド時処理（アプローチB・主軸）】
scripts/enrich.js
  └─ data/books.json を読み込み
  └─ data/book-metadata.json（既存データ）を読み込み
  └─ 未取得ISBNのみを対象に外部APIを呼び出し
  └─ data/book-metadata.json に書き込み

【実行時（アプローチA・補完）】
SPA起動時
  └─ data/books.json と data/book-metadata.json を並行fetch
        │
書籍詳細を開く
  └─ book-metadata.json にデータあり → 即時表示（APIコールなし）
  └─ book-metadata.json にデータなし → 既存のランタイム取得にフォールバック
```

---

## 詳細設計: アプローチB（ビルド時事前取得）

### 新規スクリプト: `scripts/enrich.js`

#### 処理フロー

```
起動
  ↓
data/books.json 読み込み
data/book-metadata.json 読み込み（なければ空オブジェクト `{}` として扱う）
  ↓
ISBNを持つ書籍を対象に絞り込み（`book.isbn` が非null・非空）
--force フラグ未指定時 → すでに metadata に登録済みの ISBN を除外（差分のみ対象）
  ↓
ISBN-10 → ISBN-13 変換（対象ISBNに適用）
  ↓
【ステップ1】openBD バルク取得
  100件ずつ分割してリクエスト
  ヒットしたISBNのデータを一時マップに格納
  ↓
【ステップ2】NDL Search 取得（openBDでデータなしのISBNのみ）
  1件ずつ、300ms間隔で順次リクエスト（XML応答をパース）
  ↓
【ステップ3】Google Books 取得（openBD・NDLでもdescriptionなしのISBNのみ）
  1件ずつ、500ms間隔（APIキーなし・上限は低め）
  ↓
取得結果をマージして data/book-metadata.json に保存
完了サマリーを標準出力（取得数・未取得数・API別ヒット数）
```

#### コマンド例

```bash
# 差分取得（未取得ISBNのみ対象）
node scripts/enrich.js

# 全件再取得
node scripts/enrich.js --force

# Google Books をスキップ
node scripts/enrich.js --skip-google
```

**実行タイミング:** 手動実行のみ。実行手順は `docs/dev/workflow_user_guidance.md` に記載する。

#### ISBN-10 → ISBN-13 変換ロジック

```js
function isbn10to13(isbn10) {
  const base = '978' + isbn10.slice(0, 9);
  const weights = [1,3,1,3,1,3,1,3,1,3,1,3];
  const sum = base.split('').reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}
```

### データファイル: `data/book-metadata.json`

**Git管理対象。** `enrich.js` 実行後、更新されたファイルをコミットしてリポジトリで共有する。

#### スキーマ

キーは `books.json` の `isbn` フィールド（ISBN-10）と一致させる。

```json
{
  "4774129844": {
    "coverUrl": "https://cover.openbd.jp/9784774129846.jpg",
    "publisher": "技術評論社",
    "publishedYear": "2009",
    "description": "LaTeX2εを使って美しい文書を作るための...",
    "sources": ["openbd"],
    "fetchedAt": "2026-03-03"
  },
  "4004307139": {
    "coverUrl": null,
    "publisher": "岩波書店",
    "publishedYear": "2001",
    "description": null,
    "sources": ["ndl"],
    "fetchedAt": "2026-03-03"
  },
  "XXXXXXXXXXX": {
    "coverUrl": null,
    "publisher": null,
    "publishedYear": null,
    "description": null,
    "sources": [],
    "fetchedAt": "2026-03-03"
  }
}
```

#### フィールド定義

| フィールド | 型 | 内容 |
|-----------|-----|------|
| `coverUrl` | string \| null | 書影URL（openBD / Google Books） |
| `publisher` | string \| null | 出版社名 |
| `publishedYear` | string \| null | 出版年（`YYYY` 形式に正規化して格納） |
| `description` | string \| null | あらすじ・内容紹介 |
| `sources` | string[] | データ取得元（`"openbd"`, `"ndl"`, `"google_books"` の組み合わせ） |
| `fetchedAt` | string | 取得日（`YYYY-MM-DD`） |

**設計上の注意:**
- `publishedYear` はAPI側のフォーマット（openBD: `YYYYMM`、Google Books: `YYYY-MM-DD`）に依らず、`enrich.js` 側で `YYYY` の4文字に正規化して保存する
- 全APIで取得できなかった書籍も `sources: []` としてレコードを作成する（次回差分取得時に再処理されないようにするため）
- `book-metadata.json` のスキーマは既存の `useExternalBookData.js` の正規化済みデータモデル（`coverUrl`, `publisher`, `publishedYear`, `description`）と一致させ、SPA側でのフィールドマッピングを不要にする

#### API別データ優先順位

| フィールド | 第1優先 | 第2優先 | 第3優先 |
|-----------|---------|---------|---------|
| `coverUrl` | openBD | Google Books | NDL Searchサムネイル |
| `publisher` | openBD | NDL Search | Google Books |
| `publishedYear` | openBD | NDL Search | Google Books |
| `description` | openBD | Google Books | — |

#### レート制限対応

| API | 方式 | 1回のリクエスト量 | 待機 | 認証 |
|-----|------|----------------|------|------|
| openBD | バルク | 100件/リクエスト | なし（制限なし） | 不要 |
| NDL Search | 逐次 | 1件/リクエスト | 300ms | 不要（個人利用）。XMLレスポンスは `fast-xml-parser` でパース |
| Google Books | 逐次 | 1件/リクエスト | 500ms | なし（APIキー不使用） |

---

## 詳細設計: アプローチA（ランタイム取得の改修）

### SPA起動時の並行データロード

`src/hooks/useBooks.js` を拡張し、`books.json` と `book-metadata.json` を
起動時に並行fetchして両方のデータを保持する。

```
SPA起動
  └─ Promise.all([
       fetch('./data/books.json'),
       fetch('./data/book-metadata.json')   ← 新規追加
     ])
  └─ 両方のロード完了後に描画開始
  └─ book-metadata.json が存在しない or fetchに失敗しても graceful fallback（空オブジェクト扱い）
```

### データの受け渡し経路（変更後）

```
App.jsx
  useBooks() → { books, bookMetadata, loading, error }
    │
    └─ BookDetailPage
         └─ BookExternalInfo isbn={book.isbn} preloaded={bookMetadata[book.isbn]}
              └─ useExternalBookData(isbn, preloaded)
```

### `useExternalBookData.js` の変更

引数に `preloaded` を追加し、値があれば即 `loaded` 状態として返す。
値がない場合のみ既存のランタイムAPI取得フローを実行する。

```
useExternalBookData(isbn, preloaded)
  ↓
preloaded が非null → status='loaded', data=preloaded を即時返却（APIコールなし）
preloaded が null → 既存フロー（openBD → Google Books ランタイム取得）
```

### 変更後の全体フロー

```
書籍詳細を開く
  ↓
bookMetadata[isbn] が存在する（enrichスクリプト実行済み）
  → 即時表示（ローディングなし、APIコールなし）

bookMetadata[isbn] が null または undefined（enrichスクリプト未実行・未ヒット）
  → openBD ランタイム取得（既存動作）
  → データなし → Google Books ランタイム取得（既存動作）
  → データなし → 「外部情報なし」表示
```

---

## 変更対象ファイル

| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------|
| `scripts/enrich.js` | **新規作成** | 書誌情報事前取得スクリプト |
| `data/book-metadata.json` | **新規生成** | enrich.js の出力ファイル（Git管理対象） |
| `src/hooks/useBooks.js` | **変更** | `book-metadata.json` の並行fetchを追加、`bookMetadata` を返す |
| `src/hooks/useExternalBookData.js` | **変更** | `preloaded` 引数を追加し、存在する場合は即時返却 |
| `src/components/BookExternalInfo.jsx` | **変更** | `preloaded` props を受け取り `useExternalBookData` に渡す |
| `src/pages/BookDetailPage.jsx` | **変更** | `bookMetadata` を受け取り `BookExternalInfo` に `preloaded` として渡す |
| `src/App.jsx` | **変更** | `bookMetadata` を `useBooks` から受け取り `BookDetailPage` に渡す |
| `docs/app/architecture.md` | **変更** | データフロー・ディレクトリ構成・外部連携テーブルを更新 |

---

## 影響範囲

| カテゴリ | 影響 |
|---------|------|
| データパイプライン | `enrich.js` を新規追加。`process.js` は変更なし |
| `data/book-metadata.json` | 新規ファイル。Git管理対象。`process.js` 再実行でも消えない |
| `books.json` | 変更なし（スキーマ維持） |
| `useBooks.js` | 返り値に `bookMetadata` を追加するが、既存の `books` / `loading` / `error` は変わらない |
| `useExternalBookData.js` | 引数追加（`preloaded` はオプション）。既存の呼び出し元は変更なしで動作継続 |
| 書籍詳細画面 | `preloaded` データがある書籍はローディングスピナーが表示されなくなる（表示速度が向上） |
| 書籍一覧・統計 | 影響なし |

---

## テスト計画

### `scripts/enrich.js` の動作確認

| 確認項目 | 確認方法 |
|---------|---------|
| ISBN-10 → ISBN-13 変換が正しい | 既知の書籍（例: `4774129844` → `9784774129846`）で検証 |
| openBD バルク取得が100件単位で分割される | 100件超のISBNリストで実行して分割ログを確認 |
| 既存の `book-metadata.json` が保持される（差分取得） | 一部登録済みの状態で実行し、登録済みISBNが再取得されないことを確認 |
| `--force` で全件再取得される | `--force` 付きで実行し、全件の `fetchedAt` が更新されることを確認 |
| 全APIで取得できない書籍が `sources: []` で記録される | ISBNの存在しない書籍で確認 |
| `publishedYear` が YYYY 形式で格納される | openBD（YYYYMM）/ Google Books（YYYY-MM-DD）の各レスポンスで検証 |
| `book-metadata.json` が不正なJSONになっていない | `node -e "require('./data/book-metadata.json')"` で検証 |

### SPA の動作確認

| 確認項目 | 確認方法 |
|---------|---------|
| `book-metadata.json` あり → ローディングなしで即時表示 | enrich.js実行後にSPAで書籍詳細を開く |
| `book-metadata.json` なし → ランタイムAPIコールにフォールバック | ファイルを削除してSPAで書籍詳細を開く |
| `book-metadata.json` のフェッチ失敗時もSPAがクラッシュしない | devtools でネットワークエラーを発生させて確認 |
| metadata に `sources: []`（全APIミス）の書籍 → 「外部情報なし」表示 | 対象書籍の詳細を開いて確認 |

---

## 未決事項

なし
