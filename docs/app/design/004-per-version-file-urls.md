# 設計ドキュメント 004: バージョン別PDFリンクの修正

**Issue**: #15 PDFへのリンクが各バージョンごとに別れていない
**作成日**: 2026-03-01
**ステータス**: ドラフト

---

## 概要

書籍詳細画面に表示される「Kindle版で開く」「iPad版で開く」「オリジナル版で開く」のリンクがすべて同一ファイルを指している。

原因はデータ処理スクリプト（`scripts/process.js`）の重複排除処理において、オリジナル版の `file_url` / `file_id` のみを保存しており、各バージョン固有のURLを保持していないため。

本設計ではデータスキーマを変更し、バージョンごとのファイルURLを `books.json` に格納する。

---

## 現状の問題

### データ処理（`scripts/process.js`）

`deduplicateBooks()` 関数（L279〜L320）の重複排除処理において、統合書籍に保存されるのはオリジナル版の `file_url` と `file_id` のみ：

```js
books.push({
  ...
  versions: group.map(f => f.version),  // バージョン名一覧（正しい）
  file_url: original.file_url,           // オリジナル版URLのみ
  file_id: original.file_id,             // オリジナル版IDのみ
});
```

### UIコンポーネント（`src/components/BookVersionLinks.jsx`）

全バージョンのリンクに同一の `fileUrl` を使用：

```jsx
<a href={fileUrl} ...>
  {VERSION_LABELS[version]}で開く
</a>
```

### books.json 現状スキーマ（問題箇所）

```json
{
  "versions": ["kindle", "ipad3", "original"],
  "file_url": "https://drive.google.com/file/d/xxxxx/view",
  "file_id": "xxxxx"
}
```

---

## 技術的アプローチ

### スキーマ変更

`file_url` / `file_id` をバージョン別のマップ `version_files` に置き換える。

**変更後スキーマ：**

```json
{
  "versions": ["kindle", "ipad3", "original"],
  "version_files": {
    "kindle":   { "file_url": "https://drive.google.com/...", "file_id": "abc123" },
    "ipad3":    { "file_url": "https://drive.google.com/...", "file_id": "def456" },
    "original": { "file_url": "https://drive.google.com/...", "file_id": "ghi789" }
  }
}
```

`file_url` / `file_id` のトップレベルフィールドは削除する。

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `scripts/process.js` | `deduplicateBooks()` を修正してバージョン別URLを収集、`main()` の出力マッピングで `version_files` を出力 |
| `data/books.json` | `process.js` を再実行して再生成 |
| `src/components/BookVersionLinks.jsx` | `fileUrl` の代わりに `versionFiles` を受け取り、各バージョンのURLを参照 |
| `src/pages/BookDetailPage.jsx` | `BookVersionLinks` に渡す props を変更 |
| `docs/app/architecture.md` | books.json スキーマ記述を更新 |

### process.js の修正方針

`deduplicateBooks()` 内で `version_files` を構築：

```js
const version_files = {};
for (const f of group) {
  version_files[f.version] = { file_url: f.file_url, file_id: f.file_id };
}

books.push({
  ...
  versions: group.map(f => f.version),
  version_files,
  // file_url / file_id は削除
});
```

### BookVersionLinks.jsx の修正方針

```jsx
export default function BookVersionLinks({ versions, versionFiles }) {
  return (
    <div className="flex flex-wrap gap-2">
      {versions.map(version => (
        <a
          key={version}
          href={versionFiles[version]?.file_url}
          ...
        >
          {VERSION_LABELS[version] ?? version}で開く
        </a>
      ))}
    </div>
  );
}
```

---

## 影響範囲

| カテゴリ | 影響 |
|---------|------|
| `books.json` スキーマ | `file_url` / `file_id` を `version_files` に置き換え（破壊的変更） |
| `process.js` | `deduplicateBooks()` ・`main()` の修正 |
| `BookVersionLinks.jsx` | props インターフェースの変更（`fileUrl` → `versionFiles`） |
| `BookDetailPage.jsx` | props の渡し方を変更 |
| `process.test.js` | `deduplicateBooks()` のテストケース更新が必要 |
| `architecture.md` | スキーマ記述の更新 |

既存の `versions` 配列は変更しないため、バージョン一覧の表示ロジックへの影響はない。

---

## テスト計画

### 単体テスト（`scripts/process.test.js`）

- `deduplicateBooks()` が複数バージョンのファイルを受け取った際に `version_files` を正しく構築することを確認
- 各バージョンに正しい `file_url` / `file_id` が格納されていることを確認
- 既存テストのアサーション（`file_url`, `file_id` のトップレベル参照）を `version_files` に対応するよう更新

### 手動確認

1. `node scripts/process.js` を実行して `data/books.json` を再生成
2. 複数バージョンを持つ書籍（例: `versions: ["kindle", "ipad3", "original"]`）の `version_files` に各バージョンのURLが正しく入っていることを確認
3. 開発サーバーで書籍詳細を開き、各バージョンのリンクが異なるURLを指すことを確認
4. バージョンが1つのみの書籍でも正常に動作することを確認
