# 032: Gemini APIによる書誌情報充足

**Issue**: #38
**作成日**: 2026-03-27
**ステータス**: ドラフト

---

## 概要

書誌情報が未設定の書籍について、Gemini API へ一件ずつ問い合わせることで順次充足させる。
主な対象は Kindle 書籍（303件）で、著者・ページ数が全件未設定の状態。
`generate-ai-comments.js` と同じ差分更新モデルで実装し、無料枠内で少しずつ補完できるようにする。

---

## 課題の整理

### 現状の未設定フィールド

| フィールド | 未設定件数 | 主な原因 |
|-----------|----------|---------|
| `author` | 321件（Kindle: 303件） | Kindle CSV にタイトルのみ、著者なし |
| `pages` | 370件（Kindle: 303件） | Kindle CSV にページ数情報なし |
| `subgenre` | 661件 | ジャンル推定ロジックで未分類 |

### 現行 `enrich.js` との違い

| 項目 | enrich.js | 本機能 |
|-----|-----------|--------|
| 対象 | ISBNありの書籍（`book-metadata.json` への外部API取得） | 書籍自体の基本フィールドが未設定の書籍 |
| API | openBD / NDL / Google Books | Gemini API のみ |
| 出力 | `book-metadata.json`（表紙・出版社・あらすじ） | `data/book-gemini-enrichment.json`（author・pages等） |
| 適用 | 実行時にフロントで参照 | `process.js` に統合、`books.json` 再生成で反映 |

---

## 技術的アプローチ

### 1. 対象フィールドの優先度

| 優先度 | フィールド | 対象書籍の条件 | 理由 |
|-------|----------|-------------|------|
| 高 | `author` | `author` が空文字または未設定 | 303件（Kindle全件）が対象、アプリ表示・検索に直接影響 |
| 高 | `pages` | `pages` が null | 同上 |
| 低 | `subgenre` | `subgenre` が null | 661件が対象だが、既存のフィルタ機能への影響は限定的 |

**フェーズ1では `author` と `pages` のみを対象とする。** `subgenre` は別 Issue で検討する。

### 2. Gemini への問い合わせ内容

書籍タイトルと識別子（ASIN / ISBN）を入力し、構造化 JSON を返答させる。

**プロンプトテンプレート（author・pages）**:

```
以下の書籍の著者名とページ数を調べてください。

タイトル: {title}
{ASIN行 or ISBN行（あれば追記）}

以下のJSON形式で回答してください（不明な場合は null）:
{"author": "著者名（日本語表記）", "pages": ページ数の数値}

JSONのみを出力してください（前置きや説明は不要です）。
```

### 3. 出力の保存先と適用方法

#### 方式比較

| 方式 | 説明 | メリット | デメリット |
|-----|------|---------|-----------|
| **A: 新規 JSON ファイル + process.js 統合** | `book-gemini-enrichment.json` に保存し、`process.js` で `books.json` 生成時に適用 | パイプラインの一貫性を保てる。再生成でも反映される | process.js の修正が必要 |
| **B: book-corrections.json に追記** | 既存の corrections 配列に Gemini 結果を追加 | 既存の仕組みを再利用 | 手動補正と自動取得が混在する。`original_title` キーの変換が必要 |
| **C: books.json に直接上書き** | スクリプトが books.json を直接更新 | シンプル | books.json は process.js で再生成するファイル（CLAUDE.md 禁止事項） |

**採用方式: A**

- `data/book-gemini-enrichment.json` を新規作成（Git管理対象）
- キーは `books.json` の `id` フィールド
- `process.js` のパイプライン最終段でこのファイルを読み込み、該当フィールドを上書き適用

### 4. データ構造

#### `data/book-gemini-enrichment.json`

```json
{
  "B013DZ3RM6": {
    "author": "ゆうきゆう",
    "pages": 192,
    "enrichedAt": "2026-03-27",
    "model": "gemini-2.5-flash-lite"
  },
  "B00I8PIBEG": {
    "author": "ゆうきゆう",
    "pages": null,
    "enrichedAt": "2026-03-27",
    "model": "gemini-2.5-flash-lite"
  }
}
```

- `author` が null の場合はフォールバックせず、books.json の既存値（空文字）を保持
- `pages` が null の場合も同様
- 1件生成するたびに都度ファイルに書き込む（中断時のデータ損失防止）

### 5. スクリプト動作フロー

```
data/books.json
data/book-gemini-enrichment.json（既存データ。なければ空オブジェクト）
    │
    ▼ 対象書籍の特定
    │  ・デフォルト（差分モード）: author が空または pages が null の書籍のうち、
    │    enrichment.json に未登録のもの
    │  ・--all: 全未設定書籍を再問い合わせ（上書き）
    │
    ▼ Gemini API 呼び出し（1件ずつ）
    │  ・タイトル・ASIN/ISBN をプロンプトに埋め込む
    │  ・JSON レスポンスをパース
    │  ・APIキーは環境変数 GEMINI_API_KEY から取得
    │  ・429 (quota exceeded) を受信した場合は即座に処理を中断
    │
    ▼ book-gemini-enrichment.json への保存
       ・1件生成するたびに都度ファイルに書き込む
       ・取得結果を既存データとマージして保存
```

### 6. process.js への統合

`process.js` の最終段（`books.json` 出力前）に以下の処理を追加：

```js
// Apply Gemini enrichment (author, pages) if file exists
const enrichment = loadJson(GEMINI_ENRICHMENT_PATH, {});
for (const book of books) {
  const e = enrichment[book.id];
  if (!e) continue;
  if (e.author && !book.author) book.author = e.author;
  if (e.pages && !book.pages) book.pages = e.pages;
}
```

- 既存の値（空文字 `""` を含む）がある場合は上書きしない
- `author` が `""` の場合は「未設定」として扱い、Gemini 値を適用する

---

## 影響範囲

| カテゴリ | 影響 |
|---------|------|
| 新規スクリプト | `scripts/enrich-gemini.js` |
| 新規データファイル | `data/book-gemini-enrichment.json` |
| 変更スクリプト | `scripts/process.js`（enrichment 適用ステップ追加） |
| 変更データファイル | `data/books.json`（process.js 再実行後に著者・ページ数が補完される） |
| 依存パッケージ | `@google/generative-ai`（既存。追加不要） |
| 既存機能 | 書籍一覧・書籍詳細・統計への影響なし（データ充足による表示改善あり） |
| enrich.js | 変更なし |

---

## テスト計画

| テスト項目 | 内容 |
|-----------|------|
| T-1: 差分動作 | 既に enrichment.json に登録済みの書籍が再問い合わせされないことを確認 |
| T-2: 上書き防止 | author が空でない書籍には Gemini 値が適用されないことを確認 |
| T-3: null 処理 | Gemini が null を返した場合、books.json の既存値が変わらないことを確認 |
| T-4: quota 中断 | 429 エラー時に中断し、直前までの結果が保存されることを確認 |
| T-5: --all オプション | 既登録書籍も含めて再問い合わせされることを確認 |
| T-6: process.js 統合 | enrich-gemini.js 実行後に process.js を実行すると author・pages が補完されることを確認 |
| T-7: JSON パース | Gemini のレスポンスが不正 JSON の場合にエラーとせず当該書籍をスキップすることを確認 |

---

## 未決定事項

- `subgenre` の充足を別 Issue として切り出すかどうか（本 Issue の範囲外として暫定除外）
- Gemini から返される著者名の表記揺れへの対応（例: 「著: XX」「XX 著」など）は初期実装では対応しない
