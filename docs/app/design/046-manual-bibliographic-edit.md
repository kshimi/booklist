# 設計書 #046 書誌情報の手動更新機能

**作成日**: 2026-04-10
**Issue**: #46
**ステータス**: レビュー待ち

---

## 概要

主にKindle書籍を対象として、著者名・ジャンルなどの書誌情報をブラウザ上のUIから手動入力し、ローカルのデータファイルに反映する機能を追加する。

### 背景

- Kindle書籍303冊のうち著者名が全件未設定（Amazon注文履歴CSVには著者情報が含まれない）
- 著者ランキング・著者絞り込みなどの機能でKindle書籍が活用できていない
- 書籍詳細に「Amazonで開く」リンクがあるため、ユーザーは手動で書誌情報を確認できる

### 現状の数値

| 項目 | 件数 |
|------|------|
| 総書籍数 | 1,178冊 |
| Kindle書籍 | 303冊 |
| 著者名未設定（全体） | 321冊 |
| 著者名未設定（Kindle） | 303冊（100%） |
| ジャンル「未分類」 | 318冊 |

---

## 技術的アプローチ

### 全体方針

ローカル開発環境（`npm run dev`）での利用を前提に、以下の仕組みで実現する。

```
[ブラウザ]
  書籍一覧で「書誌情報未設定」に絞り込み
  → 書籍詳細モーダルで書誌情報を入力
  → POST /api/corrections（Vite dev serverのカスタムミドルウェア）
  → book-corrections.json に保存
  → ユーザーが npm run process を手動実行
  → books.json が更新される
```

### コンポーネント構成

#### 新規追加

| ファイル | 種別 | 役割 |
|--------|------|------|
| `src/components/BookEditForm.jsx` | コンポーネント | 書誌情報入力フォーム |
| `vite.config.js` | 設定ファイル | APIミドルウェア追加 |

#### 変更

| ファイル | 変更内容 |
|--------|---------|
| `src/pages/BookDetailPage.jsx` | 編集フォームの表示制御を追加 |
| `src/pages/BookListPage.jsx` | 「書誌情報未設定」フィルタを追加 |
| `data/book-corrections.json` | `id_corrections` フィールドを追加 |
| `scripts/process.js` | `id_corrections` の適用処理を追加 |

---

### 機能詳細

#### F-46-1: 書誌情報未設定フィルタ（書籍一覧）

書籍一覧（S-1）に「書誌情報未設定のみ表示」チェックボックスを追加する。

- 条件: `author === ''`（著者名が空）の書籍を抽出
- 既存のジャンル・キーワード・著者フィルタと組み合わせ可能

#### F-46-2: 書誌情報入力フォーム（書籍詳細）

書籍詳細（S-2）モーダルに「書誌情報を編集」ボタンを追加し、展開すると入力フォームを表示する。

**表示条件**: `source` に `amazon_kindle` が含まれる書籍（著者の有無は問わない）

**入力フィールド**:

| フィールド | 種別 | 必須 | 備考 |
|----------|------|------|------|
| 著者名 | テキスト | 任意 | 空欄を許可（「不明」として扱う） |
| ジャンル | セレクト | 任意 | 既存の11ジャンルから選択 |
| サブジャンル | テキスト | 任意 | 自由入力 |
| ページ数 | 数値 | 任意 | 正整数のみ |

**保存動作**:
1. フォームの値を `POST /api/corrections` に送信（`{ id, author, genre, subgenre, pages }`）
2. サーバーが `book-corrections.json` の `id_corrections` に書き込む
3. 成功メッセージを表示。画面上のデータは次回 `npm run process` 実行後に反映される旨を案内

#### F-46-3: Vite APIミドルウェア

`vite.config.js` にカスタムミドルウェアを追加し、開発時のみ `POST /api/corrections` を受け付ける。

```js
// vite.config.js（概略）
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const correctionsPlugin = {
  name: 'corrections-api',
  configureServer(server) {
    server.middlewares.use('/api/corrections', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const { id, author, genre, subgenre, pages } = JSON.parse(body);
        const filePath = path.resolve(__dirname, 'data/book-corrections.json');
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!data.id_corrections) data.id_corrections = {};
        data.id_corrections[id] = { author, genre, subgenre, pages };
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      });
    });
  }
};

export default defineConfig({ plugins: [react(), correctionsPlugin] });
```

#### F-46-4: process.js の拡張

`book-corrections.json` に `id_corrections` フィールドを追加し、`process.js` でKindle書籍の書誌情報を上書きする。

**適用タイミング**: F-1c（Kindleインポート）後、F-2（ジャンル推定）前

```json
// book-corrections.json 拡張フォーマット
{
  "corrections": [ ... ],        // 既存（original_title ベース）
  "id_corrections": {            // 新規追加（book ID / ASIN ベース）
    "B013DZ3RM6": {
      "author": "大野裕",
      "genre": "ノンフィクション",
      "subgenre": "心理学",
      "pages": 184
    }
  }
}
```

**適用ロジック**:
- `id_corrections[book.id]` が存在する場合、対応フィールドを上書き
- 値が空文字列・null・undefined の場合は上書きしない（既存値を維持）

---

## 影響範囲

| 対象 | 変更 | リスク |
|------|------|--------|
| `book-corrections.json` | フォーマット拡張（後方互換あり） | 低 |
| `scripts/process.js` | `id_corrections` 適用処理を追加 | 低 |
| `src/pages/BookDetailPage.jsx` | 編集フォーム表示追加 | 低 |
| `src/pages/BookListPage.jsx` | フィルタUI追加 | 低 |
| `src/components/BookEditForm.jsx` | 新規作成 | — |
| `vite.config.js` | 新規作成・APIミドルウェア追加 | 低 |

**本番環境への影響**: なし（APIミドルウェアは開発時のみ動作）

---

## テスト計画

| テスト項目 | 確認方法 |
|----------|---------|
| フィルタ: 著者名未設定書籍のみ表示 | Kindle書籍のみが表示されることを目視確認 |
| 入力フォームの表示 | Kindle書籍の詳細を開いて「編集」ボタン表示を確認 |
| 保存: `book-corrections.json` への書き込み | POST後にファイル内容が更新されることを確認 |
| `process.js` の適用 | `id_corrections` を手動追加して `npm run process` を実行し、books.json に反映されることを確認 |
| 既存 `corrections` への非影響 | Google Drive書籍の書誌情報が変わらないことを確認 |
| 本番ビルドへの非影響 | `npm run build` でAPIミドルウェアが含まれないことを確認 |

---

## 未決事項・制約

- **process.js 自動実行**: 保存後に `npm run process` を自動実行するか否か。自動実行するとbooks.jsonを再生成するため利便性は上がるが、実装コストが増す。初期実装では手動実行とし、UIで案内メッセージを表示する。
- **ページリロード**: `npm run process` 実行後は手動でブラウザをリロードする必要がある。HMRでは対応しない。
- **本番運用**: 本機能はローカル開発環境専用。静的ホスティングに書き込みAPIは不要のため含めない。
