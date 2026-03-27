# 設計ドキュメント #031: Amazon Kindleコンテンツリスト統合

**作成日**: 2026-03-27
**更新日**: 2026-03-27
**対象Issue**: #31
**ステータス**: レビュー待ち

---

## 概要

Amazon Kindleで購入済みの書籍を書籍ライブラリに追加する。
Amazon公式の「デジタル注文履歴」からダウンロードしたCSVファイル（`data/kindle-list.csv`）を入力ソースとして追加し、`process.js` でのデータ処理に組み込む。

Kindleコンテンツは「Google DriveにアップロードされたKindle版PDF（`version: "kindle"`）」とは別物であり、Amazon Kindle Store上で購入・管理されるデジタルコンテンツを指す。

---

## 技術的アプローチ

### データ入力形式

Amazonの「デジタル注文履歴」からダウンロードしたCSVファイルをそのまま `data/kindle-list.csv` として配置して使用する。

**データ取得手順:**
1. amazon.co.jp → アカウントサービス → 注文履歴 → 「デジタル注文履歴」
2. CSV形式でダウンロードし、`data/kindle-list.csv` として保存

**CSVの主要カラム（Amazonが出力する形式）:**

| カラム名 | 説明 |
|---------|------|
| `ASIN` | AmazonのASIN番号（10文字英数字）。書籍識別子に使用 |
| `Product Name` | 書籍タイトル（シリーズ巻番号・副題を含む） |
| `Publisher` | 出版社名（`"Not Applicable"` の場合あり） |
| `Order Status` | 注文ステータス。`SUCCESS` のみ処理対象とする |
| `Order Date` | 購入日 |

**制約:**
- 著者名はCSVに含まれない。著者フィールドは空文字列として扱う
- 1件の購入が `Component Type`（Tax / Price Amount 等）ごとに複数行に分かれるため、ASINで重複排除が必要
- `Product Name` に `[雑誌]` 等のサフィックスが付く場合がある

### 新規ソース値

`source` フィールドに `"amazon_kindle"` を追加する（既存値: `"google_drive"`, `"paper"`）。

| 値 | 意味 |
|----|------|
| `"amazon_kindle"` | Amazon Kindle Storeで購入済みのデジタルコンテンツ |

組み合わせパターン（重複統合後）:

| source値 | 意味 |
|----------|------|
| `"amazon_kindle"` | Kindleのみ |
| `"google_drive"` | Google Drive PDFのみ |
| `"paper"` | 紙書籍のみ |
| `["amazon_kindle", "google_drive"]` | KindleとGoogle Drive PDF両方 |
| `["amazon_kindle", "paper"]` | Kindleと紙書籍両方 |
| `["google_drive", "paper"]` | 既存：Google Drive PDFと紙書籍両方 |
| `["amazon_kindle", "google_drive", "paper"]` | 全ソース |

### データ構造の変更

`books.json` の1レコードに `asin` フィールドを追加する。

```json
{
  "id": "B08YH9CBGM",
  "title": "三体",
  "author": "",
  "genre": "未分類",
  "subgenre": null,
  "series": null,
  "isbn": null,
  "asin": "B08YH9CBGM",
  "pages": null,
  "versions": [],
  "version_files": {},
  "source": "amazon_kindle"
}
```

> 著者名はAmazon CSVに含まれないため空文字列となる。ジャンルはタイトルキーワードで推定する。

**IDの決定ロジック（優先順）:**

1. ISBNあり → ISBNをIDに使用（既存ロジック、書籍統合可能）
2. ISBNなし、ASINあり → ASINをIDに使用
3. いずれもなし → タイトルハッシュを使用（既存フォールバック）

**重複排除・書籍統合ロジックの拡張（F-3）:**

統合キーは既存ロジック（ISBN → タイトル）を踏襲する。ASINは統合キーではなく付加フィールドとして扱う。

| 統合キー | 条件 |
|---------|------|
| ISBN | ISBNが存在する場合（既存） |
| タイトル | ISBNなし（既存フォールバック） |

> Kindle書籍にISBNはないため、既存のGoogle Drive / 紙書籍と同タイトルであればタイトルキーで統合される。

### process.js への変更

`F-1b`（オフラインCSVインポート）に相当する処理 `F-1c` を追加する。

```
F-1c: Amazon Kindle CSVインポート
  ・data/kindle-list.csv を読み込む（存在しない場合はスキップ）
  ・Order Status === "SUCCESS" の行のみ対象とする
  ・ASIN単位で重複排除する（同一ASINが複数行に出現するため）
  ・Product Name から末尾の "[...]" サフィックス（[雑誌] 等）を除去してタイトルとする
  ・著者名は空文字列とする
  ・ジャンルはタイトルキーワードで推定する（GENRE_FALLBACK_RULES を使用）
  ・source = "amazon_kindle" を付与
  ・ASIN フィールドを設定
```

### UI変更

**書籍カード（S-1: 書籍一覧）:**
- `source` に `"amazon_kindle"` が含まれる場合、「Kindle」バッジを表示（既存の「PDF」「紙」バッジと同列）

**書籍詳細（S-2）:**
- `source` に `"amazon_kindle"` が含まれる場合:
  - `asin` がある場合: Amazon商品ページへのリンクを表示（`https://www.amazon.co.jp/dp/{ASIN}`）
  - `asin` がない場合: 「Kindleで所持」テキストを表示（リンクなし）

---

## 影響範囲

| 対象 | 変更内容 | 規模 |
|------|---------|------|
| `data/kindle-list.csv` | Amazon CSVをそのまま配置（入力データ） | 新規 |
| `scripts/process.js` | F-1c追加（`parseKindleCsv`）、`asin` フィールド対応 | 小〜中 |
| `data/books.json` | `asin` フィールド追加、`source` 値の拡張 | スキーマ変更 |
| `src/components/BookCard` | sourceバッジ表示に `"amazon_kindle"` 追加 | 小 |
| `src/components/BookDetail` | Kindleリンク・「Kindleで所持」表示追加 | 小 |
| `docs/app/architecture.md` | ソース値・データフロー記載の更新 | ドキュメント |
| `docs/app/spec/functional/data-processing.md` | F-1c追加、F-3ロジック更新 | ドキュメント |

**影響なし:**
- `scripts/enrich.js`（書誌情報取得はISBNベース。ISBNがあれば既存処理で対応可）
- `scripts/generate-ai-comments.js`（IDベースで動作、変更不要）
- `data/book-metadata.json`（ISBNがある本は自動的に書誌情報取得対象に）

---

## テスト計画

| テストケース | 確認内容 |
|------------|---------|
| 同一ASINが複数行の場合 | 1件に重複排除される |
| Order Status が SUCCESS 以外の行 | 除外される |
| `Product Name` に `[雑誌]` サフィックスあり | 除去されてタイトルに設定される |
| Kindle専用書籍（ASINあり・ISBNなし） | ASINがIDとして設定される |
| Kindle書籍とGoogle Drive PDFのタイトル一致 | sourceが `["amazon_kindle", "google_drive"]` に統合される |
| Kindle書籍と紙書籍のタイトル一致 | sourceが `["amazon_kindle", "paper"]` に統合される |
| source="amazon_kindle" のカードに「Kindle」バッジ表示 | UIでバッジが正しく表示される |
| ASINありの書籍詳細でAmazonリンク表示 | `https://www.amazon.co.jp/dp/{ASIN}` が表示される |
| process.js 実行後の books.json レコード数確認 | Kindleリスト分が追加されている |
