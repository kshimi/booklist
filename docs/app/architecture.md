# アーキテクチャ

**作成日**: 2026-02-28
**更新日**: 2026-03-03
**ステータス**: ドラフト v0.2
**対象フェーズ**: フェーズ1（静的SPA）

---

## システム構成

**静的 SPA 方式**を採用する。バックエンドサーバーは持たず、ビルド済みの HTML/CSS/JS ファイルとあらかじめ生成した JSON データをブラウザで直接読み込む。

```
【ビルド前工程（データ処理）】
Google Drive
  └─ Google Apps Script で CSV 取得
        │
        ▼
data/booklist.csv
  └─ node scripts/process.js
        │  ・CSVパース・ファイル名メタデータ抽出
        │  ・ジャンル推定（フォルダパスベース）
        │  ・重複排除・書籍統合
        ▼
data/books.json（812件）

data/books.json
  └─ node scripts/enrich.js          ← 手動実行（任意のタイミング）
        │  ・ISBNで外部APIを呼び出し
        │  ・書影URL・出版社・出版年・あらすじを取得
        │  ・差分取得（未取得ISBNのみ対象）
        ▼
data/book-metadata.json              ← Git管理対象外

【実行時（ブラウザ）】
PC または iPad のブラウザ
  └─ SPA 起動
        │  books.json と book-metadata.json を並行 fetch
        │
        ├─ 書籍一覧（検索・フィルタ・ソート）
        ├─ 書籍詳細
        │    ├─ Google Drive リンク → PDF を Google Drive で開く
        │    ├─ book-metadata.json にデータあり → 即時表示
        │    └─ book-metadata.json にデータなし → openBD / Google Books をランタイム呼び出し
        └─ 統計ダッシュボード（ジャンル分布・著者ランキング）
```

---

## 技術スタック

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| フロントエンド | React（SPA）+ Vite | — |
| スタイリング | Tailwind CSS | — |
| データ形式 | JSON（`data/books.json`, `data/book-metadata.json`） | — |
| データ処理 | Node.js スクリプト | — |
| インフラ | ローカルファイル / 静的ホスティング | — |
| テスト | 未定 | — |

---

## ディレクトリ構成

```
booklist/
├── data/
│   ├── booklist.csv              # Google Apps Script 出力（入力データ）
│   ├── books.json                # process.js 生成の蔵書カタログ
│   ├── book-metadata.json        # enrich.js 生成の外部書誌情報（Git管理対象外）
│   ├── author-aliases.json       # 著者名エイリアステーブル
│   └── book-corrections.json     # 書籍タイトル・著者名手動補正テーブル
├── scripts/
│   ├── process.js                # 蔵書カタログ生成スクリプト
│   ├── enrich.js                 # 外部書誌情報取得スクリプト
│   └── list-missing-authors.js   # 著者名未設定書籍確認ツール
├── src/                          # SPA ソースコード
│   ├── hooks/
│   │   ├── useBooks.js           # books.json + book-metadata.json のロード
│   │   └── useExternalBookData.js # 外部書誌情報取得フック（ランタイム）
│   ├── components/
│   └── pages/
├── docs/                         # プロジェクトドキュメント
└── ...
```

---

## データフロー

### データ処理パイプライン（ビルド前工程）

#### process.js パイプライン

```
data/booklist.csv
    │
    ▼ F-1: CSVインポート・メタデータパース
    │  ・application/pdf のみ対象
    │  ・管理用ファイルを除外（self_check 等）
    │  ・ファイル名から順次抽出:
    │      バージョン → 拡張子除去 → ISBN → ページ数
    │      → シリーズ名 → 著者名 → タイトル
    │  ・著者名補完パターン（P-A: 欧文名, P-B: 漢字氏名）
    │  ・book-corrections.json による最終上書き
    │
    ▼ F-2: ジャンル推定（大ジャンル）
    │  ・フォルダパスのキーワードマッチ（優先順位付き）
    │  ・11ジャンル（SF / フィクション（日本）/ エッセイ / …/ 未分類）
    │
    ▼ F-2b: サブジャンル推定
    │  ・タイトル・著者名・シリーズ名のキーワードマッチ
    │
    ▼ F-3: 重複排除・書籍統合
    │  ・統合キー: ISBN あり → ISBN、なし → タイトル
    │  ・オリジナル版のタイトル・著者を優先
    │
    ▼ F-4: books.json 生成
       ・UTF-8、812件（2026-03-03時点）
```

#### enrich.js パイプライン（手動実行）

```
data/books.json
data/book-metadata.json（既存データ。なければ空オブジェクト）
    │
    ▼ E-1: 対象ISBN特定
    │  ・ISBNを持つ書籍に絞り込み
    │  ・差分モード: metadata 未登録のISBNのみ対象
    │
    ▼ E-2: ISBN変換
    │  ・ISBN-10 → ISBN-13 変換
    │
    ▼ E-3: 外部API呼び出し（優先順位順）
    │  ・openBD: 100件バルク取得（制限なし）
    │  ・NDL Search: 1件ずつ・300ms待機（XML応答を fast-xml-parser でパース）
    │  ・Google Books: 1件ずつ・500ms待機（APIキーなし）
    │
    ▼ E-4: book-metadata.json 保存
       ・取得結果を既存データとマージして保存
       ・全APIミスの書籍も sources:[] として記録（再取得対象外に）
```

### books.json のデータ構造（1レコード）

```json
{
  "id": "一意識別子（ISBN またはタイトルハッシュ）",
  "title": "書名",
  "author": "著者名",
  "genre": "大ジャンル",
  "subgenre": "サブジャンル または null",
  "series": "シリーズ名 または null",
  "isbn": "ISBN または null",
  "pages": 186,
  "versions": ["original", "kindle"],
  "version_files": {
    "original": { "file_url": "https://drive.google.com/...", "file_id": "Google Drive ファイルID" },
    "kindle":   { "file_url": "https://drive.google.com/...", "file_id": "Google Drive ファイルID" }
  }
}
```

### book-metadata.json のデータ構造（1レコード）

キーは `books.json` の `isbn` フィールド（ISBN-10）。

```json
{
  "4774129844": {
    "coverUrl": "https://cover.openbd.jp/9784774129846.jpg",
    "publisher": "技術評論社",
    "publishedYear": "2009",
    "description": "あらすじテキスト...",
    "sources": ["openbd"],
    "fetchedAt": "2026-03-03"
  }
}
```

### 画面構成と遷移

| 画面ID | 画面名 | 主な機能 |
|--------|--------|---------|
| S-1 | 書籍一覧 | キーワード検索・ジャンルフィルタ（大ジャンル/サブジャンル2階層）・著者絞り込み・ソート・ページネーション（50件/ページ） |
| S-2 | 書籍詳細 | 基本情報 + Google Drive PDF リンク + 外部書誌情報（書影・出版社・出版年・あらすじ） |
| S-3 | 統計ダッシュボード | ジャンル分布グラフ・著者別保有冊数ランキング（上位20名） |

```
書籍一覧（S-1）
  ├── 書籍カードをクリック → 書籍詳細（S-2）
  │   └── 著者名をクリック → 書籍一覧（S-1）著者絞り込み状態
  └── タブ切替 → 統計ダッシュボード（S-3）
      ├── ジャンルグラフをクリック → 書籍一覧（S-1）ジャンルフィルタ状態
      └── 著者名をクリック → 書籍一覧（S-1）著者絞り込み状態
```

---

## 外部連携

### ビルド時（enrich.js から呼び出し）

| API | 用途 | 認証 | 備考 |
|-----|------|------|------|
| openBD API | 書影・出版社・出版年・あらすじ（主力） | 不要 | 100件バルク可、制限なし |
| NDL Search API | openBD未収録書籍の補完。NDC分類・ページ数 | 不要（個人利用） | XML応答、1件/300ms |
| Google Books API | あらすじ補完 | 不要（APIキーなし） | 1件/500ms |

### ランタイム（ブラウザから直接呼び出し・フォールバック）

| API | 用途 | 呼び出し条件 | 認証 |
|-----|------|------------|------|
| openBD API | 書籍詳細の書誌情報 | book-metadata.json に未登録のISBNがある場合（第1優先） | 不要 |
| Google Books API | openBDでデータなしの場合のフォールバック | openBDで取得できなかった場合 | 不要（APIキーなし） |

---

## セキュリティ

| 項目 | 内容 |
|------|------|
| 認証・アクセス制御 | 個人利用のためなし |
| 実行環境 | PC または iPad のブラウザ。Google Drive へのアクセス権限が必要 |
| 外部書誌API | ビルド時（Node.js）およびブラウザからの直接呼び出し（CORS 対応済み公開API）。APIキー不使用 |
| データ取得 | Google Drive への直接 API アクセスは行わず、Google Apps Script で取得した CSV を使用する |
| PDF 参照 | 書籍詳細の `version_files[version].file_url`（Google Drive リンク）をブラウザで開くことで PDF を閲覧する |
| book-metadata.json | 個人の書籍コレクション情報のみ含む。Git 管理対象外とし、実行環境ごとに生成する |
