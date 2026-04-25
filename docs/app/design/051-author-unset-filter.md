# 設計書 #051 著者絞り込みに「著者未設定」選択肢を追加

**作成日**: 2026-04-25
**Issue**: #51
**ステータス**: レビュー待ち

---

## 概要

書籍一覧の著者絞り込みドロップダウン（`AuthorFilter`）に「著者未設定」選択肢を追加する。
選択すると著者名が空文字列の書籍のみ表示され、書誌情報の手動編集（#46）の対象を絞り込みやすくなる。

### 現状の数値

| 項目 | 件数 |
|------|------|
| 総書籍数 | 1,178冊 |
| 著者名未設定（`author === ''`） | 320冊（約27%） |

---

## 技術的アプローチ

### 全体方針

著者未設定を「著者名の一種」として扱い、ドロップダウンの選択肢に加える。
現在の `selectedAuthor` 状態管理は `null`（フィルタなし）と文字列（著者名）の2値だが、
センチネル値 `'__UNSET__'` を追加して3値にする。

```
selectedAuthor = null        → フィルタなし（全件表示）
selectedAuthor = '__UNSET__' → author === '' の書籍のみ表示
selectedAuthor = '著者名'    → その著者の書籍のみ表示（既存）
```

### 変更ファイル

| ファイル | 変更内容 |
|--------|---------|
| `src/components/AuthorFilter.jsx` | 「著者未設定」選択肢を先頭に追加 |
| `src/pages/BookListPage.jsx` | センチネル値の定数定義とフィルタロジックの更新 |

### 変更詳細

#### `AuthorFilter.jsx`

「著者未設定」を「すべての著者」の直後に配置する。

```jsx
const AUTHOR_UNSET = '__UNSET__';

export default function AuthorFilter({ authors, selectedAuthor, onSelect }) {
  return (
    <select
      value={selectedAuthor ?? ''}
      onChange={e => onSelect(e.target.value || null)}
      className="..."
    >
      <option value="">すべての著者</option>
      <option value={AUTHOR_UNSET}>著者未設定</option>
      {authors.map(author => (
        <option key={author} value={author}>{author}</option>
      ))}
    </select>
  );
}
```

`onSelect(e.target.value || null)` の挙動は既存のまま：
- `''`（すべての著者）→ `null`
- `'__UNSET__'`（著者未設定）→ `'__UNSET__'`（truthy のため変換なし）
- `'著者名'` → そのまま通過

#### `BookListPage.jsx`

フィルタロジックを1行更新する。

```js
// 変更前
.filter(book => !selectedAuthor || book.author === selectedAuthor)

// 変更後
const AUTHOR_UNSET = '__UNSET__';
// ...
.filter(book => {
  if (!selectedAuthor) return true;
  if (selectedAuthor === AUTHOR_UNSET) return book.author === '';
  return book.author === selectedAuthor;
})
```

`AUTHOR_UNSET` 定数は両ファイル間で共有するため、
`src/constants.js`（既存）に定義することも検討できるが、
AuthorFilter と BookListPage の2ファイル内にとどまるため各ファイルにローカル定義で十分。

### 既存機能との関係

| 機能 | 関係 |
|------|------|
| 「書誌情報未設定のみ」チェックボックス（F-15） | 同じ条件（`author === ''`）をフィルタ。両方有効にしても重複するだけで矛盾しない。 |
| 著者名クリックによる絞り込み | `handleAuthorSelect` を呼ぶ既存経路は変更なし |
| `filterOverride`（統計ページからの遷移） | `filterOverride.author` は実在の著者名のみ設定されるため影響なし |

---

## 影響範囲

| 対象 | 変更 | リスク |
|------|------|--------|
| `src/components/AuthorFilter.jsx` | 選択肢を1つ追加 | 低 |
| `src/pages/BookListPage.jsx` | フィルタロジック1行変更 | 低 |
| `data/books.json` / `scripts/*.js` | 変更なし | — |
| 本番ビルド・静的ホスティング | 変更なし | — |

---

## テスト計画

| テスト項目 | 確認方法 |
|----------|---------|
| 「著者未設定」を選択すると320冊が表示される | 結果件数を目視確認 |
| 「すべての著者」を選択すると全件に戻る | 結果件数を目視確認 |
| 既存の著者名フィルタが正常に動作する | 任意の著者を選択して件数が変わることを確認 |
| キーワード検索との AND 条件 | 「著者未設定」選択中にキーワード入力して件数が絞り込まれることを確認 |
| ジャンルフィルタとの AND 条件 | 「著者未設定」選択中にジャンルを切り替えて件数が絞り込まれることを確認 |
| 「書誌情報未設定のみ」チェックボックスとの共存 | 両方有効にしてもエラーや不整合が起きないことを確認 |
