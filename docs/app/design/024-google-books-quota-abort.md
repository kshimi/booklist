# 設計ドキュメント 024: Google Books API クォータ超過時のリクエスト中断

**Issue:** #24 書誌情報取得でQuotaに達してもリクエストを繰り返してしまう
**作成日:** 2026-03-03
**ステータス:** 実装済み

---

## 概要

`scripts/enrich.js` の Google Books API 取得ループで、クォータ超過（HTTP 429）が発生しても後続のリクエストを継続してしまうバグを修正する。

クォータ超過後のリクエストはすべて 429 で失敗するため、ループを早期終了させることで不要なリクエストと待機時間を排除する。

---

## バグの原因

### 現状の挙動

```
Google Books ループ（gbTargets の各 ISBN に対して）
  └─ fetchGoogleBooks(isbn13) を呼び出し
        └─ withRetry(..., maxAttempts=3) 内で最大3回リトライ（429 はリトライ対象）
              └─ 3回すべて失敗 → エラーをスロー
  └─ catch(err) → failedISBNs.google に追加
  └─ 次の ISBN へ継続（クォータ超過後も同じループを継続）
```

### 問題の本質

Google Books API のクォータは **1日の総リクエスト数に基づく制限**であり、クォータ超過後は当日中のすべてのリクエストが 429 を返す。

- `withRetry` が 429 をリトライ対象として1秒・2秒・3秒と待機しながら3回試みるが、クォータ超過状態ではすべて失敗する
- リトライ後もエラーは `failedISBNs.google` に記録されてループが継続し、残りのすべての ISBN に対して同様の無駄なリトライが発生する
- 例：残り200件の場合、1件あたり最大 6秒（1+2+3秒）× 200件 = 最大 1200秒（約20分）の無駄な待機が発生する

---

## 設計方針

HTTP 429 エラーを「クォータ超過」として検出したら、Google Books ループを即座に中断する。

### 修正範囲

`scripts/enrich.js` のみ変更する。他のファイルへの影響なし。

---

## 詳細設計

### 変更箇所: Google Books 取得ループ（Step 3）

#### 変更前

```javascript
// --- Step 3: Google Books (sequential, for description gaps) ---
if (!SKIP_GOOGLE) {
  const gbTargets = targets.filter(b => !results[b.isbn]?.description);
  let gbHits = 0;
  console.log(`[Google Books] ${gbTargets.length} ISBNs to try`);
  for (const b of gbTargets) {
    const isbn13 = isbn10to13Map[b.isbn];
    if (!isbn13) continue;
    try {
      const entry = await fetchGoogleBooks(isbn13);
      if (entry) {
        if (results[b.isbn]) {
          results[b.isbn] = mergeInto(results[b.isbn], entry);
        } else {
          results[b.isbn] = entry;
        }
        gbHits++;
      }
    } catch (err) {
      failedISBNs.google.push(b.isbn);
    }
    await wait(500);
  }
  console.log(`[Google Books] ${gbHits} hits`);
}
```

#### 変更後

ループ本体を `runGoogleBooksStep()` として分離し、`main()` から呼び出す形に変更した。

```javascript
// ループ本体（テスタビリティのために分離）
async function runGoogleBooksStep(targets, results, isbn10to13Map, failedISBNs, fetchFn, delayMs) {
  let gbHits = 0;
  let googleQuotaExceeded = false;
  for (const b of targets) {
    if (googleQuotaExceeded) break;
    const isbn13 = isbn10to13Map[b.isbn];
    if (!isbn13) continue;
    try {
      const entry = await fetchFn(isbn13);
      if (entry) {
        if (results[b.isbn]) {
          results[b.isbn] = mergeInto(results[b.isbn], entry);
        } else {
          results[b.isbn] = entry;
        }
        gbHits++;
      }
    } catch (err) {
      if (/HTTP 429/.test(err.message)) {
        googleQuotaExceeded = true;
        console.warn('[Google Books] Quota exceeded. Skipping remaining requests.');
      } else {
        failedISBNs.google.push(b.isbn);
      }
    }
    if (!googleQuotaExceeded) await wait(delayMs);
  }
  return gbHits;
}

// --- Step 3: Google Books (sequential, for description gaps) ---
if (!SKIP_GOOGLE) {
  const gbTargets = targets.filter(b => !results[b.isbn]?.description);
  console.log(`[Google Books] ${gbTargets.length} ISBNs to try`);
  const gbHits = await runGoogleBooksStep(gbTargets, results, isbn10to13Map, failedISBNs, fetchGoogleBooks, 500);
  console.log(`[Google Books] ${gbHits} hits`);
}
```

### 変更のポイント

| 変更点 | 内容 |
|--------|------|
| `googleQuotaExceeded` フラグの追加 | クォータ超過検出用のブール変数 |
| ループ先頭での早期 `break` | フラグが立っていれば即座にループ終了 |
| catch ブロックのエラー分岐 | HTTP 429 → フラグをセット + 警告ログ、その他 → 従来通り `failedISBNs.google` に追加 |
| クォータ超過後の wait をスキップ | `if (!googleQuotaExceeded) await wait(delayMs)` — 429 検出時に不要な待機を排除 |
| ループ本体を `runGoogleBooksStep()` に分離 | `fetchFn` と `delayMs` を注入可能にしてユニットテストを可能にする |

### `withRetry` の扱いについて

`withRetry` は現在 429 をリトライ対象としている。

- **変更しない**：クォータ超過ではない一時的なレート制限（短時間での過多リクエスト）に対してはリトライが有効なケースもある
- クォータ超過の場合、`withRetry` が3回リトライして最終的に 429 エラーをスローし、catch ブロックで検出・中断する

この設計により、`withRetry` の汎用性を維持しつつ、Google Books ループ側でクォータ超過を適切に処理できる。

---

## 影響範囲

| カテゴリ | 影響 |
|---------|------|
| `scripts/enrich.js` | Step 3 のループに変更あり |
| `data/book-metadata.json` | 変更なし（出力フォーマットに影響なし） |
| SPA（フロントエンド） | 影響なし |
| openBD / NDL 取得ステップ | 影響なし |

---

## テスト計画

| 確認項目 | 確認方法 |
|---------|---------|
| クォータ超過時にループが中断される | `fetchGoogleBooks` を 429 エラーを返すモック関数に差し替えて実行し、最初の 429 で即座に中断することを確認 |
| 中断時に警告ログが出力される | `[Google Books] Quota exceeded. Skipping remaining requests.` が標準エラー出力に表示されることを確認 |
| 429 以外のエラーは従来通り `failedISBNs.google` に記録される | 404 エラーのモックで実行し、後続 ISBN の処理が継続することを確認 |
| クォータ超過前に取得済みのデータは保存される | 2件目で 429 になるモックで、1件目のデータが `book-metadata.json` に保存されることを確認 |

---

## 未決事項

なし
