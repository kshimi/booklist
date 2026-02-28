# 設計ドキュメント 001: データ処理機能の実装

**Issue**: #1
**作成日**: 2026-02-28
**ステータス**: 完了
**対象フェーズ**: フェーズ1（静的SPA）

---

## 概要

機能仕様書（[`docs/app/spec/functional/data-processing.md`](../spec/functional/data-processing.md)）にもとづき、データ処理パイプライン（F-1〜F-4）を実装する。

### 対象範囲

| 対象 | 内容 |
|------|------|
| 実装スクリプト | `scripts/process.js` |
| 入力データ | `data/booklist.csv`（既存） |
| 出力データ | `data/books.json`（新規生成） |
| テスト | `scripts/process.test.js` |

### 対象外

- SPA（React）のフロントエンド実装
- UI機能（検索・フィルタ・書籍詳細・統計ダッシュボード）
- 外部API連携（OpenBD / Google Books）

---

## 技術的アプローチ

### 実装方針

- **単一ファイル構成**: `scripts/process.js` に全処理をまとめる
- **外部ライブラリ不使用**: Node.js 標準モジュール（`fs`、`path`）のみ使用
- **Node.js バージョン**: v18+ を前提とする

### 処理フロー

```
data/booklist.csv
    │
    ├─ ステップ1: CSV読み込み・フィルタリング（F-1）
    │    ・MIMEタイプ = application/pdf のみ対象
    │    ・管理用ファイル名（self_check 等）を除外
    │
    ├─ ステップ2: ファイル名パース（F-1）
    │    ・バージョン判定 → 拡張子除去 → ISBN → ページ数
    │    → シリーズ名 → 著者名 → タイトル の順で抽出
    │
    ├─ ステップ3: ジャンル推定（F-2）
    │    ・フォルダパスのキーワードマッチ（優先順位付き）
    │    ・11ジャンル対応
    │
    ├─ ステップ4: 重複排除・書籍統合（F-3）
    │    ・統合キー: ISBNあり → ISBN、なし → タイトル
    │    ・オリジナル版の値を優先
    │
    └─ ステップ5: books.json 出力（F-4）
         ・UTF-8、インデント2スペース
         ・書名の辞書順にソート
         ・処理統計をコンソール出力
```

詳細な実装仕様は [`docs/app/spec/system/data-pipeline.md`](../spec/system/data-pipeline.md) を参照。

### テスト方針

**Node.js 組み込みテストランナー（`node:test`）を使用する。**

| 選択肢 | 採用理由 |
|--------|---------|
| `node:test`（組み込み） | 外部ライブラリ不要、Node.js v18+ で利用可能、実装方針と一致 |
| Jest | npm依存が発生する。現段階では過剰 |

テストファイル: `scripts/process.test.js`
実行コマンド: `node --test scripts/process.test.js`

---

## 影響範囲

### 新規作成ファイル

| ファイル | 用途 |
|---------|------|
| `scripts/process.js` | データ処理パイプライン本体 |
| `scripts/process.test.js` | ユニットテスト |
| `package.json` | `npm test` コマンドの定義 |

### 生成されるファイル

| ファイル | 用途 |
|---------|------|
| `data/books.json` | SPAが参照する蔵書カタログ（819件想定） |

### 変更なし

- `data/booklist.csv`（入力データ、変更しない）
- `src/`（SPA未実装のため対象外）
- 既存ドキュメント

---

## テスト計画

### テスト対象関数

`scripts/process.js` から以下の関数をエクスポートし、個別にテストする。

| 関数名 | テスト対象 |
|--------|-----------|
| `parseCSV(text)` | CSV文字列 → 行配列への変換 |
| `filterRecords(rows)` | PDF以外・管理用ファイルの除外 |
| `parseFilename(filename)` | ファイル名 → メタデータ（タイトル・著者・ISBN等） |
| `estimateGenre(folderPath)` | フォルダパス → ジャンル |
| `deduplicateBooks(files)` | 重複排除・書籍統合 |
| `generateId(book)` | 書籍IDの生成 |

### テストケース一覧

#### parseFilename のテストケース

| テストID | 入力ファイル名 | 期待値 |
|---------|------------|-------|
| T-01 | `タイトル（シリーズ）著者名 186p_9784101020112.pdf` | title, author, isbn, pages, series が正しく抽出される |
| T-02 | `kindlep_タイトル著者名 200p_9784101020112.pdf` | version = `kindle`、プレフィックス除去済み |
| T-03 | `ipad3_タイトル著者名.pdf` | version = `ipad3`、isbn = null、pages = null |
| T-04 | `タイトル著者名.pdf` | version = `original`、isbn = null、pages = null |
| T-05 | `タイトル（シリーズA）（シリーズB）著者名 100p_1234567890.pdf` | series = `シリーズA／シリーズB`（複数シリーズを `／` 結合） |
| T-06 | ISBN なし・シリーズなし | isbn = null、series = null |

#### estimateGenre のテストケース

| テストID | 入力フォルダパス | 期待ジャンル |
|---------|--------------|------------|
| T-10 | `70_Book/SF/` | SF |
| T-11 | `70_Book/ノンフィクション/` | ノンフィクション |
| T-12 | `70_Book/フィクション/` | フィクション |
| T-13 | `70_Book/フィクション/ノンフィクション/` | ノンフィクション（優先度高） |
| T-14 | `70_Book/日本の作家/` | フィクション（日本） |
| T-15 | `70_Book/` | 未分類 |

#### filterRecords のテストケース

| テストID | 入力レコード | 期待結果 |
|---------|-----------|---------|
| T-20 | MIMEタイプ = `text/plain` | 除外される |
| T-21 | ファイル名に `self_check` を含む | 除外される |
| T-22 | ファイル名に `20120330_1246_33_0706` を含む | 除外される |
| T-23 | MIMEタイプ = `application/pdf`、管理用識別子なし | 通過する |

#### deduplicateBooks のテストケース

| テストID | 入力 | 期待結果 |
|---------|------|---------|
| T-30 | 同一ISBN の original + kindle | 1件に統合。versions = `["original", "kindle"]` |
| T-31 | 同一タイトルの original + ipad3（ISBNなし） | 1件に統合。versions = `["original", "ipad3"]` |
| T-32 | original + kindle で genre が異なる場合 | 優先度の高いジャンルを採用 |
| T-33 | original なし、kindle のみ | kindle の値をタイトル・著者として使用 |

#### 統合テスト

| テストID | 内容 |
|---------|------|
| T-40 | `data/booklist.csv` を入力として処理を実行し、出力が819件であることを確認 |
| T-41 | 出力 `books.json` の各レコードに必須フィールド（id, title, author, genre, versions）が存在することを確認 |
| T-42 | id の重複がないことを確認 |

### 受け入れ条件

- 全テストケース（T-01〜T-42）が `node --test` で PASS すること
- `node scripts/process.js` を実行して `data/books.json` が819件で生成されること

---

## 実装手順

1. `package.json` を作成し、`"test": "node --test scripts/process.test.js"` を定義
2. `scripts/process.js` を実装（各関数をモジュールエクスポート）
3. `scripts/process.test.js` を作成し、上記テストケースを実装
4. テストを全件 PASS させる
5. `node scripts/process.js` で `data/books.json` を生成・検証
