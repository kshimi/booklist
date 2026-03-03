# 設計書 #26: 紙書籍リストのデータ統合

**作成日**: 2026-03-03
**Issue**: [#26 GoogleDrive以外の書誌リストもデータに追加する](https://github.com/kshimi/booklist/issues/26)
**ステータス**: レビュー待ち

---

## 概要

`data/offline_bibliography_list.csv`（62冊の紙書籍リスト）を既存のデジタル書籍カタログ（`data/books.json`、812件）と統合する。
統合後は書籍一覧画面に紙書籍も表示し、UI上でデジタル（Google Drive PDF）か紙書籍かを判別できるようにする。

### 対象データ

| ファイル | 件数 | 入力元 |
|---------|------|-------|
| `data/booklist.csv` | 約1,900レコード（812冊に統合後） | Google Drive経由 |
| `data/offline_bibliography_list.csv` | 62件 | 手動作成 |

`offline_bibliography_list.csv` のカラム構成:

```
ジャンル, 書名, 著者名, 出版社
```

---

## 技術的アプローチ

### アプローチ比較

| 観点 | A: process.js に直接統合 | B: 別スクリプト（process-offline.js）で統合 |
|-----|------------------------|------------------------------------------|
| 実装量 | 少ない（既存関数を再利用） | 多い（新規スクリプト + マージロジックが必要） |
| 実行手順 | `node scripts/process.js` 1回 | `node scripts/process.js && node scripts/process-offline.js` の2段階 |
| 関心の分離 | やや低い（1ファイルに複数入力） | 高い（入力ごとにスクリプト分離） |
| 著者名名寄せの再利用 | ○（既存関数をそのまま適用） | ○（関数をインポート） |
| 重複排除の統合 | ○（既存 deduplicateBooks() を1回通す） | △（マージ時に別途重複排除が必要） |

**推奨: アプローチA（process.js への直接統合）**

- オフラインCSVはボリュームが小さく（62件）、将来的に増える可能性も低い
- 著者名正規化・エイリアス解決・重複排除を1つのパイプラインで統一できる
- 実行手順が変わらないため、既存のワークフローへの影響が最小限

---

### データフロー（変更後）

```
data/booklist.csv              data/offline_bibliography_list.csv
    │                                  │
    ▼ F-1: CSVインポート・             ▼ F-1b: オフラインCSVパース
    │       メタデータ抽出              │  ・ジャンルマッピング（表参照）
    │       （既存処理）                │  ・著者名正規化・エイリアス解決
    │                                  │  ・source = "paper" を付与
    └──────────────────┬───────────────┘
                       │ ファイルレコード結合
                       ▼ F-2: 重複排除・書籍統合
                       │  ・統合キー: ISBN or タイトル
                       │  ・同書籍がデジタル・紙両方に存在する場合:
                       │    source = ["google_drive", "paper"]
                       ▼ F-3: books.json 生成
```

---

### スキーマ変更

`books.json` の各レコードに `source` フィールドを追加する。

| 値 | 意味 |
|---|------|
| `"google_drive"` | Google Drive PDFのみ |
| `"paper"` | 紙書籍のみ |
| `["google_drive", "paper"]` | デジタル・紙の両方を所持 |

変更後のレコード例（紙書籍）:

```json
{
  "id": "title_a1b2c3d4",
  "title": "プログラマの数学",
  "author": "結城浩",
  "genre": "コンピュータ",
  "subgenre": null,
  "series": null,
  "isbn": null,
  "pages": null,
  "versions": [],
  "version_files": {},
  "source": "paper"
}
```

変更後のレコード例（デジタル・紙の両方）:

```json
{
  "id": "4774129844",
  "title": "例：デジタルと紙の両方を持つ書籍",
  "author": "著者名",
  "genre": "コンピュータ",
  "subgenre": null,
  "series": null,
  "isbn": "4774129844",
  "pages": 300,
  "versions": ["original"],
  "version_files": { "original": { "file_url": "...", "file_id": "..." } },
  "source": ["google_drive", "paper"]
}
```

> **注意**: 既存の Google Drive 書籍レコードには `source: "google_drive"` を付与する（後方互換性のため）。

---

### ジャンルマッピング

`offline_bibliography_list.csv` のジャンル名を `books.json` のジャンル体系に変換する。

| offline CSV ジャンル | books.json ジャンル | 備考 |
|--------------------|---------------------|------|
| コンピュータ・IT技術 | コンピュータ | — |
| 物理・自然科学・農学 | ノンフィクション | サブジャンル: 科学・技術 |
| 文学・小説・教養 | 既存の GENRE_FALLBACK_RULES で推定 | タイトル・著者名ベース |
| コミックス | 漫画・コミック | — |
| 趣味・実用・自動車 | 実用 | 自動車系タイトルは 運転 にも可（フォールバックルールで対応） |

「文学・小説・教養」は書籍によって SF・フィクション・ノンフィクション等に分かれるため、タイトル・著者名ベースの既存 `GENRE_FALLBACK_RULES` を適用して推定する。

---

### 著者名の名寄せ

offline CSV の著者名にも既存の正規化処理を適用する。

1. `normalizeAuthor()`: 全角ピリオド正規化・スペース→中黒変換
2. `resolveAuthorAlias()`: `author-aliases.json` によるエイリアス解決

Google Drive 側と offline 側で同一著者の表記ゆれがある場合は、`author-aliases.json` にエントリを追加して対応する。

---

### 重複排除

既存の `deduplicateBooks()` を拡張して `source` を集約する。

- **ISBNが一致する場合**: 同一書籍として統合、`source` を配列に
- **タイトルが一致する場合（ISBN無し）**: 同一書籍として統合、`source` を配列に
- **一致なし**: それぞれ独立したレコードとして追加

---

## 影響範囲

### 変更が必要なファイル

| ファイル | 変更内容 |
|---------|---------|
| `scripts/process.js` | offline CSV パース関数の追加、ジャンルマッピングテーブル追加、`source` フィールドの付与、`deduplicateBooks()` の拡張 |
| `src/components/BookCard.jsx` | `source` に基づくバッジ表示の追加 |
| `src/pages/BookDetailPage.jsx` | `source` に基づく表示の切り替え（紙書籍はGoogle Driveリンクなし） |
| `docs/app/architecture.md` | `books.json` スキーマ更新、データフロー図更新 |

### 変更不要なファイル

- `scripts/enrich.js`: ISBNが無い紙書籍はスキップされる（既存ロジックで対応済み）
- `src/hooks/useBooks.js`: `books.json` のロード処理は変更不要
- `data/author-aliases.json`: 必要に応じて追記（スクリプト変更なし）

---

## UI 表示設計

### 書籍カード（BookCard.jsx）

`source` に応じてバッジを表示する。

| source | バッジ表示 | スタイル例 |
|--------|----------|-----------|
| `"google_drive"` | `PDF` | 緑系 |
| `"paper"` | `紙` | 茶系 |
| `["google_drive", "paper"]` | `PDF` `紙` | 両方表示 |

### 書籍詳細（BookDetailPage.jsx）

- `source` が `"paper"` のみの場合: Google Drive リンクセクションを非表示にし、代わりに「紙書籍」ラベルを表示する
- `source` が `["google_drive", "paper"]` の場合: Google Drive リンクを表示し、「紙書籍としても所持」をラベル表示する

---

## テスト計画

### 単体テスト（scripts/process.js）

| テストケース | 検証内容 |
|------------|---------|
| offline CSV のジャンルマッピング | 各ジャンルが正しく変換されること |
| offline CSV の著者名正規化 | normalizeAuthor・resolveAuthorAlias が適用されること |
| 重複排除（digital + paper） | 同一書籍が統合され、source が配列になること |
| 重複排除（paper のみ） | 独立したレコードとして追加されること |
| source フィールドの付与 | すべてのレコードに source が設定されること |

### 結合確認（手動）

- `node scripts/process.js` 実行後、`data/books.json` の件数が増加していること
- `source: "paper"` のレコードが 62 件程度含まれること（重複除く）
- UI で「紙」バッジが表示されること
- 紙書籍の詳細ページで Google Drive リンクが表示されないこと

---

## 未決事項・リスク

| 項目 | 内容 |
|-----|------|
| offline CSV のジャンル「文学・小説・教養」 | GENRE_FALLBACK_RULES での推定精度が低い場合、多くが「未分類」になる可能性がある。初回実行後に手動確認が必要 |
| 著者名の表記ゆれ | offline CSV と Google Drive 側で同一著者が別名表記の可能性。統合後に確認し、必要に応じて author-aliases.json を更新する |
| ISBN の有無 | offline CSV には ISBN が含まれていないため、重複排除はタイトル一致のみに依存する。タイトル表記が異なると重複排除が効かない可能性がある |
