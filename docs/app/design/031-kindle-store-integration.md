# 設計ドキュメント #031: Amazon Kindleコンテンツリスト統合

**作成日**: 2026-03-27
**更新日**: 2026-03-27（前処理スクリプト方針に変更）
**対象Issue**: #31
**ステータス**: レビュー待ち

---

## 概要

Amazon Kindleで購入済みの書籍を書籍ライブラリに追加する。
Amazon公式の「デジタル注文履歴」からダウンロードしたCSVファイル（`data/kindle-list.csv`）を入力として、**前処理スクリプト** `scripts/parse-kindle-list.js` で書籍データを抽出・整形し、その結果を `data/kindle-books.json` として出力する。`process.js` はこのファイルを新たな入力ソースとして取り込む。

```
data/kindle-list.csv
  └─ node scripts/parse-kindle-list.js    ← 前処理（手動実行）
        ├─ 書籍絞り込み（映画・雑誌・無料除外）
        ├─ 複数巻統合
        └─ data/kindle-books.json

data/kindle-books.json
  └─ node scripts/process.js（既存）
        └─ F-1c: Kindle書籍インポート      ← 追加
```

Kindleコンテンツは「Google DriveにアップロードされたKindle版PDF（`version: "kindle"`）」とは別物であり、Amazon Kindle Store上で購入・管理されるデジタルコンテンツを指す。

---

## 技術的アプローチ

### 入力データ形式

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

**制約:**
- 著者名はCSVに含まれない。著者フィールドは空文字列として扱う
- 1件の購入が `Component Type`（Tax / Price Amount 等）ごとに複数行に分かれるため、ASINで重複排除が必要
- `Product Name` に `[雑誌]` `[ビデオ]` 等の種別サフィックスが付く場合がある

### 前処理スクリプト（`scripts/parse-kindle-list.js`）

`kindle-list.csv` を読み込み、書籍データを抽出・整形して `data/kindle-books.json` を出力する独立スクリプト。`process.js` の前段として手動実行する。

#### Step 1: ASIN重複排除・基本フィルタ

- `Order Status === "SUCCESS"` の行のみ対象
- 同一ASINが複数行（Tax / Price Amount コンポーネント）に出現するため、ASINで重複排除して1件にする

#### Step 2: 書籍絞り込み

以下のルールで書籍以外・不要データを除外する。

| 除外条件 | 判定方法 | 例 |
|---------|---------|-----|
| 映画・動画 | タイトルに `[ビデオ]` または `[Video]` を含む | `アニメタイトル [ビデオ]` |
| 雑誌 | タイトルに `[雑誌]` を含む | `山と溪谷 2019年 2月号 [雑誌]` |
| 無料・試し読み版 | タイトルに `無料`、`試し読み`、`お試し` のいずれかを含む | `作品名【期間限定 無料お試し版】`、`作品名 無料試し読み版` |

#### Step 3: 複数巻統合

同一作品の上下巻・複数巻を1件に統合する。

**グループキーの生成:**

`Product Name` から下記の巻番号パターンを除去し、空白を正規化したものをグループキーとする。パターンは上から順に最初に一致したものを除去する。

| 優先 | 除去パターン | マッチ例 |
|------|------------|---------|
| 1 | `（上）` `（下）` `（中）` | `三体Ⅱ　黒暗森林（上）` |
| 2 | 末尾の全角スペース + `上` `下` `中` | `三体Ⅲ　死神永生　上` |
| 3 | `（一）`〜`（十...）`（漢数字） | `太平記（三）` |
| 4 | `（１）`〜`（n）`（全角アラビア数字） | `宇宙兄弟（２５）` |
| 5 | `(1)`〜`(n)`（半角数字括弧） | `罠ガール(7)` |
| 6 | 末尾の半角スペース + アラビア数字 | `弱虫ペダル 16` |
| 7 | ローマ数字サフィックス（`I`〜`XV` 等） | `ローマ人の物語 XIV` |

> **注意**: ローマ数字はタイトル本体に含まれる場合もあるため（`Ⅱ` が作品名の一部 → `三体Ⅱ`）、末尾のみを対象とし、タイトル先頭付近には適用しない。

**統合ルール:**

- グループキーが同一のレコードを1件に統合する
- 統合後のタイトルはグループキーを使用する
- 代表ASINはグループ内で最初に出現したASINを使用する

**統合例:**

| 入力（Product Name） | グループキー | 出力タイトル |
|-------------------|------------|------------|
| `三体Ⅱ　黒暗森林（上）` | `三体Ⅱ　黒暗森林` | `三体Ⅱ　黒暗森林` |
| `三体Ⅱ　黒暗森林（下）` | `三体Ⅱ　黒暗森林` | （統合） |
| `太平記（一）` | `太平記` | `太平記` |
| `太平記（二）`〜`太平記（六）` | `太平記` | （統合） |
| `宇宙兄弟（１）`〜`宇宙兄弟（２５）` | `宇宙兄弟` | `宇宙兄弟` |

#### 出力形式（`data/kindle-books.json`）

```json
[
  {
    "title": "三体Ⅱ　黒暗森林",
    "asin": "B089M77R61",
    "asins": ["B089M77R61", "B089M7M21Q"]
  },
  {
    "title": "宇宙兄弟",
    "asin": "B009SX8PAC",
    "asins": ["B009SX8PAC", "B00TGWD7NK", "..."]
  }
]
```

| フィールド | 説明 |
|-----------|------|
| `title` | 統合後のタイトル（巻番号除去済み） |
| `asin` | 代表ASIN（グループ内の最初のASIN） |
| `asins` | グループ内の全ASIN一覧 |

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
F-1c: Kindle書籍インポート
  ・data/kindle-books.json を読み込む（存在しない場合はスキップ）
  ・著者名は空文字列とする
  ・ジャンルはタイトルキーワードで推定する（GENRE_FALLBACK_RULES を使用）
  ・source = "amazon_kindle" を付与
  ・asin フィールドを設定（代表ASIN）
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
| `scripts/parse-kindle-list.js` | 新規スクリプト（前処理） | 新規・中 |
| `data/kindle-books.json` | parse-kindle-list.js の出力（中間データ） | 新規 |
| `scripts/process.js` | F-1c追加（`parseKindleBooks`）、`asin` フィールド対応 | 小〜中 |
| `data/books.json` | `asin` フィールド追加、`source` 値の拡張 | スキーマ変更 |
| `src/components/BookCard` | sourceバッジ表示に `"amazon_kindle"` 追加 | 小 |
| `src/components/BookDetail` | Kindleリンク・「Kindleで所持」表示追加 | 小 |
| `docs/app/architecture.md` | ソース値・データフロー記載の更新 | ドキュメント |
| `docs/app/spec/functional/data-processing.md` | F-1c追加、F-3ロジック更新 | ドキュメント |

**影響なし:**
- `scripts/enrich.js`（書誌情報取得はISBNベース。ISBNがあれば既存処理で対応可）
- `scripts/generate-ai-comments.js`（IDベースで動作、変更不要）
- `data/book-metadata.json`（ISBNがある本は自動的に書誌情報取得対象に）

**ファイル管理方針:**
- `data/kindle-list.csv`: Amazonからの取得データ。Git管理対象外（個人情報含む）
- `data/kindle-books.json`: 前処理スクリプトの出力。Git管理対象外（実行環境で生成）

---

## テスト計画

### parse-kindle-list.js のテスト

| テストケース | 確認内容 |
|------------|---------|
| 同一ASINが複数行（Tax + Price Amount） | 1件に重複排除される |
| `Order Status` が `SUCCESS` 以外 | 除外される |
| タイトルに `[ビデオ]` を含む | 除外される |
| タイトルに `[雑誌]` を含む | 除外される |
| タイトルに `無料` を含む | 除外される |
| タイトルに `試し読み` を含む | 除外される |
| タイトルに `お試し` を含む | 除外される |
| `（上）`/`（下）` の上下巻 | 1件に統合され、グループキーがタイトルになる |
| 末尾 `　上`/`　下` の上下巻 | 1件に統合される |
| 漢数字巻番号（`（一）`〜`（六）`） | 1件に統合される |
| 全角数字巻番号（`（１）`〜`（２５）`） | 1件に統合される |
| 半角数字括弧（`(7)`） | 1件に統合される |
| ローマ数字サフィックス（`XIV`） | 1件に統合される |
| 統合後の代表ASINはグループ内最初のASIN | 正しい代表ASINが設定される |
| `asins` フィールドに全ASIN一覧が含まれる | 統合前の全ASINが記録される |

### process.js のテスト

| テストケース | 確認内容 |
|------------|---------|
| Kindle専用書籍（ASINあり・ISBNなし） | ASINがIDとして設定される |
| Kindle書籍とGoogle Drive PDFのタイトル一致 | sourceが `["amazon_kindle", "google_drive"]` に統合される |
| Kindle書籍と紙書籍のタイトル一致 | sourceが `["amazon_kindle", "paper"]` に統合される |
| `kindle-books.json` が存在しない場合 | スキップされ既存書籍のみ出力される |

### UIテスト

| テストケース | 確認内容 |
|------------|---------|
| source="amazon_kindle" のカードに「Kindle」バッジ表示 | UIでバッジが正しく表示される |
| ASINありの書籍詳細でAmazonリンク表示 | `https://www.amazon.co.jp/dp/{ASIN}` が表示される |
