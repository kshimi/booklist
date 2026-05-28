# 設計書 #036 ローマ数字巻号パターンのコメント補足

**作成日**: 2026-05-28
**Issue**: #36
**ステータス**: レビュー待ち

---

## 概要

`scripts/parse-kindle-list.js` の `VOLUME_PATTERNS` にあるローマ数字パターン（Priority 7）に、
意図した設計上の制約と既知の限界を示すコメントを補足する。

### 調査結果: 変更は既に適用済み

Issue #36 の変更要求は、PR #32（`feature/31-kindle-integration`）の
コミット `76e51f1`（`fix: improve multi-volume grouping in parse-kindle-list.js (#31)`）
で既に実装されている。

PR #32 のマージ（2026-03-27 07:59 UTC）から約8分後に Issue #36 が作成されており、
その時点で変更は既にメインブランチに取り込まれていた。

---

## 技術的アプローチ

### 変更内容

#### 変更前（初期コミット `44babf0` の状態）

```js
// Priority 7: Roman numeral suffix at end (I through XV etc.) — only at end, not within title
/ [IVXivx]{1,6}\s*$/,
```

#### 変更後（現在のコード `scripts/parse-kindle-list.js` L213–216）

```js
// Priority 7: Roman numeral suffix at end (I through XV etc.) — only at end, not within title.
// NOTE: Intentionally broad — matches any trailing 1-6 char combination of I/V/X.
// False positives are possible but rare for Japanese book titles.
/ [IVXivx]{1,6}\s*$/,
```

### コメントの意図

| 追記内容 | 意図 |
|---------|------|
| 末尾のピリオド追加 | 既存コメントの文体統一 |
| `Intentionally broad — ...` | パターンが意図的に広めに書かれていることを明示し、将来の誤った「修正」を防ぐ |
| `False positives are possible but rare for Japanese book titles.` | 誤マッチの可能性は認識済みだが、日本語書籍タイトルでは実害がほぼないことを説明 |

---

## 影響範囲

コメントのみの変更であり、正規表現パターン自体は変更しない。

| 対象 | 変更 | リスク |
|------|------|--------|
| `scripts/parse-kindle-list.js` L213–215 | コメント追記（2行）+ 既存コメントにピリオド追加 | なし |
| 生成ファイル（`data/books.json` 等） | 変更なし | — |
| テスト | 変更なし | — |

---

## テスト計画

コメントのみの変更のため、コード動作に影響はない。

| テスト項目 | 確認方法 |
|----------|---------|
| 既存の巻号グルーピングテストが通過する | `npm test` |

---

## 推奨アクション

**変更は既にメインブランチに取り込まれているため、追加実装は不要。**
このまま Phase 1 の設計書確認を経た後、Issue #36 をクローズすることを推奨する。

通常の Phase 3（仕様書更新）・Phase 4（実装）のステップは不要。
