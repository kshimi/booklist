# 設計ドキュメント #031: Amazon Kindleコンテンツリスト統合

**作成日**: 2026-03-27
**対象Issue**: #31
**ステータス**: レビュー待ち

---

## 概要

Amazon Kindleで購入済みの書籍を書籍ライブラリに追加する。
既存の「紙書籍リスト（`offline_bibliography_list.csv`）」と同様のアプローチで、手動管理CSVファイル（`data/kindle_list.csv`）を新たな入力ソースとして追加し、`process.js` でのデータ処理に組み込む。

Kindleコンテンツは「Google DriveにアップロードされたKindle版PDF（`version: "kindle"`）」とは別物であり、Amazon Kindle Store上で購入・管理されるデジタルコンテンツを指す。

---

## 技術的アプローチ

### データ入力形式

新規ファイル `data/kindle_list.csv` を手動作成・管理する。

| カラム | 必須 | 説明 |
|--------|------|------|
| ジャンル | 必須 | `offline_bibliography_list.csv` と共通の大ジャンル名 |
| 書名 | 必須 | 書籍タイトル |
| 著者名 | 必須 | 著者名 |
| 出版社 | 任意 | 出版社名 |
| ASIN | 任意 | AmazonのASIN番号（10文字英数字）。Amazon商品ページへのリンク生成に使用 |

**サンプル行:**
```
ジャンル,書名,著者名,出版社,ASIN
コンピュータ・IT技術,Clean Code,Robert C. Martin,ASCII Media Works,B00A6P3U3K
フィクション（日本）,三体,劉慈欣,早川書房,B08YH9CBGM
```

> **データ取得方法**: Amazonの「コンテンツと端末の管理」ページで確認できる購入済みコンテンツリストを参照し、手動でCSVに記入する。

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
  "author": "劉慈欣",
  "genre": "フィクション（日本）",
  "subgenre": "SF",
  "series": null,
  "isbn": null,
  "asin": "B08YH9CBGM",
  "pages": null,
  "versions": [],
  "version_files": {},
  "source": "amazon_kindle"
}
```

**IDの決定ロジック（優先順）:**

1. ISBNあり → ISBNをIDに使用（既存ロジック、書籍統合可能）
2. ISBNなし、ASINあり → ASINをIDに使用
3. いずれもなし → タイトルハッシュを使用（既存フォールバック）

**重複排除・書籍統合ロジックの拡張（F-3）:**

| 統合キー | 条件 |
|---------|------|
| ISBN | ISBNが存在する場合（既存） |
| ASIN | ISBNなし、ASINが存在する場合（新規） |
| タイトル | ISBN・ASINともになし（既存フォールバック） |

### process.js への変更

`F-1b`（オフラインCSVインポート）に相当する処理 `F-1c` を追加する。

```
F-1c: Kindle CSVインポート
  ・data/kindle_list.csv を読み込む
  ・著者名正規化・エイリアス解決を適用
  ・ジャンル推定（大ジャンルはCSVから取得、サブジャンルはキーワード推定）
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
| `data/kindle_list.csv` | 新規作成（入力データ） | 新規 |
| `scripts/process.js` | F-1c追加、F-3重複排除ロジック拡張（ASIN対応） | 小〜中 |
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
| Kindle専用書籍（ISBNなし・ASINあり） | ASINがIDとして設定される |
| Kindle専用書籍（ISBNなし・ASINなし） | タイトルハッシュがIDとして設定される |
| Kindle書籍とGoogle Drive PDFの重複統合（ISBN一致） | sourceが `["amazon_kindle", "google_drive"]` に統合される |
| Kindle書籍と紙書籍の重複統合（ISBN一致） | sourceが `["amazon_kindle", "paper"]` に統合される |
| source="amazon_kindle" のカードに「Kindle」バッジ表示 | UIでバッジが正しく表示される |
| ASINありの書籍詳細でAmazonリンク表示 | 正しいURLが表示される |
| ASINなしの書籍詳細で「Kindleで所持」表示 | テキスト表示される |
| process.js 実行後の books.json レコード数確認 | Kindleリスト分が追加されている |
