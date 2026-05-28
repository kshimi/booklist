# 設計書 #037 deduplicateBooks 未認識ソース値の警告出力

**作成日**: 2026-05-28
**Issue**: #37
**ステータス**: レビュー待ち

---

## 概要

`scripts/process.js` の `deduplicateBooks` 関数において、グループ内の全レコードが認識されないソース値（`amazon_kindle`/`google_drive`/`paper` 以外）を持つ場合、現在は `'google_drive'` にサイレントフォールバックしている。この状況を `console.warn` で明示的に通知し、将来の不完全なソース値追加に対するデバッグ容易性を高める。

---

## 技術的アプローチ

### 変更箇所

`scripts/process.js` の `deduplicateBooks` 関数内、`source` の決定ロジック（L492–L494 付近）にフォールバック検知を追加する。

**現在のコード:**
```js
const source = presentSources.length === 0 ? 'google_drive'
  : presentSources.length === 1 ? presentSources[0]
  : presentSources;
```

**変更後:**
```js
if (presentSources.length === 0) {
  console.warn(
    `[deduplicateBooks] No recognized source in group, defaulting to google_drive. ` +
    `title="${original.title}" rawSources=${JSON.stringify([...new Set(group.map(f => f.source))])}`
  );
}
const source = presentSources.length === 0 ? 'google_drive'
  : presentSources.length === 1 ? presentSources[0]
  : presentSources;
```

Issue 本文の提案に加え、`title` と実際のソース値一覧をログに含めることでデバッグ効率を高める。フォールバック動作自体は変更しない。

---

## 影響範囲

| 対象 | 変更 | リスク |
|------|------|--------|
| `scripts/process.js` | 警告出力の条件分岐を 1 箇所追加 | なし |
| `data/books.json` | 変更なし（現状 `presentSources.length === 0` は発生しない） | — |
| フロントエンド | 変更なし | — |
| テスト | 警告出力のケースを追加 | なし |

---

## テスト計画

`scripts/process.test.js` の `deduplicateBooks` describe ブロックに以下のテストを追加する。

| テスト項目 | 確認方法 |
|----------|---------|
| 未認識ソース値のみのグループで `console.warn` が呼ばれる | `jest.spyOn(console, 'warn')` でスパイし呼び出しを検証 |
| 警告メッセージに `title` と `rawSources` が含まれる | スパイで受け取った引数を検証 |
| 正常ソース値を含むグループで `console.warn` が呼ばれない | スパイが呼ばれていないことを検証 |
| 全テストが通過する | `npm test` |
