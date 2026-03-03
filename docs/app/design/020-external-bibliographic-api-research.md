# 外部書誌情報API 調査レポート

**Issue:** #20
**作成日:** 2026-03-03
**ステータス:** 調査完了

---

## 概要

書籍詳細画面に表示する外部書誌情報を充実させるため、利用可能なAPIの調査を行った。
本プロジェクトは実装アプローチとして以下の2方向を並行して検討する。

| アプローチ | 概要 |
|-----------|------|
| **A. ランタイム取得** | SPAからブラウザ経由でAPIを呼び出し、表示時に動的取得する |
| **B. ビルド時事前取得** | `process.js` 拡張スクリプトで事前にAPIからデータを取得し、JSONファイルに埋め込む |

---

## 現状データの確認

| 項目 | 値 |
|------|-----|
| 書籍数 | 812冊 |
| ISBN保有数 | 806冊（ISBN-10形式） |
| ISBN-13 | 0件（すべてISBN-10） |
| ISBNなし | 6件 |

**注意:** openBD等のAPIはISBN-13（ハイフンなし13桁）を要求するため、ISBN-10からの変換処理が必要。

---

## 調査対象API

### 1. openBD

| 項目 | 内容 |
|------|------|
| 運営 | カーリル × 版元ドットコム |
| 認証 | 不要 |
| レート制限 | 公式制限なし（バルクアクセス想定の設計） |
| CORS | **対応（確認済）** |
| 日本語書籍カバレッジ | 非常に高い（約76万タイトル） |
| 商用利用 | 不可（書籍紹介・案内目的は可） |

**エンドポイント:**
```
GET https://api.openbd.jp/v1/get?isbn={ISBN13},{ISBN13},...
```
- ISBNはハイフンなし13桁
- 1リクエストで最大100件のISBNを指定可能（バルク対応）

**取得可能なデータ:**

| フィールド | 内容 |
|-----------|------|
| `summary.title` | タイトル |
| `summary.author` | 著者 |
| `summary.publisher` | 出版社 |
| `summary.pubdate` | 出版日（YYYYMM形式） |
| `summary.series` | シリーズ名 |
| `summary.cover` | 書影URL（サムネイル） |
| `onix.CollateralDetail.TextContent` | あらすじ・目次など（ONIX 3.0形式） |

**評価:** 日本語書籍の書誌情報充実に最適。CORS対応・認証なし・バルクISBN対応と制約が少ない。
ただし出版社がONIXデータを提供していない場合や古いタイトルはカバレッジに欠ける。

---

### 2. 国立国会図書館サーチAPI（NDL Search）

| 項目 | 内容 |
|------|------|
| 運営 | 国立国会図書館（NDL） |
| 認証 | 不要（非商用） |
| レート制限 | 非公式の絞り込みあり |
| CORS | **未確認（おそらく非対応）** |
| 日本語書籍カバレッジ | 最高（納本制度により国内全書籍） |
| 商用利用 | 要申請 |

**エンドポイント（SRU形式、XML応答）:**
```
GET https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&recordSchema=dcndl&query=isbn={ISBN}
```

**書影サムネイルURL（img直接参照可能）:**
```
https://ndlsearch.ndl.go.jp/thumbnail/{ISBN13（ハイフンなし）}.jpg
```

**取得可能なデータ:**

| フィールド | 内容 |
|-----------|------|
| `dc:title` | タイトル |
| `dc:creator` | 著者 |
| `dc:publisher` | 出版社 |
| `dc:date` | 出版日 |
| `dc:subject` | NDC分類 |
| `dc:extent` | ページ数・価格 |

**評価:** 国内全書籍を網羅する最も信頼性の高いデータソース。
サーチAPIはCORSが未対応の可能性が高く静的SPAからの直接呼び出しは困難だが、
ビルド時スクリプト（Node.js）からは利用可能。
**書影サムネイルURLは `<img>` タグで直接利用可能**（両シナリオで利用可）。

---

### 3. Google Books API

| 項目 | 内容 |
|------|------|
| 運営 | Google |
| 認証 | APIキー必要（無料） |
| レート制限 | 1,000リクエスト/日（デフォルト） |
| CORS | **対応（確認済）** |
| 日本語書籍カバレッジ | 中程度 |
| 商用利用 | 可 |

**エンドポイント:**
```
GET https://www.googleapis.com/books/v1/volumes?q=isbn:{ISBN}&key={API_KEY}
```

**取得可能なデータ:**

| フィールド | 内容 |
|-----------|------|
| `volumeInfo.title` | タイトル |
| `volumeInfo.authors` | 著者（配列） |
| `volumeInfo.publisher` | 出版社 |
| `volumeInfo.publishedDate` | 出版日 |
| `volumeInfo.description` | あらすじ |
| `volumeInfo.pageCount` | ページ数 |
| `volumeInfo.categories` | ジャンル分類 |
| `volumeInfo.imageLinks` | 書影URL（複数サイズ） |
| `volumeInfo.averageRating` | ユーザー評価 |

**評価:** CORS対応・あらすじ・書影と揃っているが、1日1,000件の制限がある。
812冊を1件ずつ取得した場合は1日で完了するが、将来の追加取得やリトライを考慮するとビルド時取得の方が安全。
日本語書籍はあらすじが英語で返ることがある。APIキーが必要なため環境変数管理が必要。

---

### 4. Open Library（Internet Archive）

| 項目 | 内容 |
|------|------|
| 運営 | Internet Archive（非営利） |
| 認証 | 不要 |
| レート制限 | 非公式（1〜3リクエスト/秒） |
| CORS | **不安定（エンドポイントにより異なる）** |
| 日本語書籍カバレッジ | 低い |
| 商用利用 | 可 |

**エンドポイント:**
```
GET https://openlibrary.org/isbn/{ISBN}.json
GET https://covers.openlibrary.org/b/isbn/{ISBN}-L.jpg   # 書影（img直接参照可）
```

**評価:** 日本語書籍のカバレッジが低く、本プロジェクトへの適合度は低い。
CORS挙動も不安定なため、ランタイム利用には不向き。ビルド時でも優先度低。

---

### 5. CiNii Books（国立情報学研究所）

| 項目 | 内容 |
|------|------|
| 運営 | NII（国立情報学研究所） |
| 認証 | 無料アプリID登録が必要 |
| レート制限 | 未公表 |
| CORS | **対応（確認済）** |
| 日本語書籍カバレッジ | 学術書に強い |
| 商用利用 | CC-BY 4.0 |

**エンドポイント:**
```
GET https://ci.nii.ac.jp/books/opensearch/search?isbn={ISBN}&format=json&appid={APP_ID}
```

**取得可能なデータ:** タイトル・著者・出版社・出版年・識別子・所蔵館情報など
（あらすじ・目次は契約上提供不可）

**評価:** CORS対応で静的SPAから利用可能。学術書・専門書の網羅性が高い。
ただしあらすじ等の詳細情報は取得できないため、書誌情報充実よりも所蔵確認用途向き。

---

### 6. 楽天ブックスAPI

| 項目 | 内容 |
|------|------|
| 運営 | 楽天 |
| 認証 | アプリID + アクセスキー（無料登録） |
| レート制限 | 非公表 |
| CORS | **非対応（ブラウザからの直接呼び出し不可）** |
| 日本語書籍カバレッジ | 販売中の書籍に強い |
| 商用利用 | 楽天ブランド表示必須 |

**取得可能なデータ:**

| フィールド | 内容 |
|-----------|------|
| `title` / `titleKana` | タイトル・フリガナ |
| `author` / `authorKana` | 著者・フリガナ |
| `publisherName` | 出版社 |
| `salesDate` | 発売日 |
| `itemCaption` | あらすじ |
| `smallImageUrl` / `largeImageUrl` | 書影URL |
| `booksGenreId` | 楽天ジャンル分類 |

**評価:** フリガナ（`titleKana`・`authorKana`）を含む日本語書籍に有益なデータを持つ。
**CORSが非対応**のため静的SPAから直接呼び出せないが、ビルド時スクリプトからは利用可能。
楽天ブランドの表示義務あり。

---

## 総合比較表

| API | 認証 | レート制限 | ランタイム利用 | ビルド時利用 | あらすじ | 書影 | 目次 |
|-----|------|-----------|:---:|:---:|:---:|:---:|:---:|
| **openBD** | 不要 | なし（バルク可） | ✅ | ✅ | ✅ | ✅ | 一部 |
| **NDL Search** | 不要 | 非公式制限 | ❌（CORS不可） | ✅ | なし | ✅（img） | なし |
| **Google Books** | APIキー | 1,000件/日 | ✅ | ✅ | ✅ | ✅ | なし |
| **Open Library** | 不要 | 非公式制限 | ❓（不安定） | △（優先度低） | 一部 | ✅（img） | 一部 |
| **CiNii Books** | アプリID | 非公表 | ✅ | ✅ | なし | なし | なし |
| **楽天ブックス** | アプリID+キー | 非公表 | ❌（CORS不可） | ✅ | ✅ | ✅ | なし |

---

## 実装アプローチの詳細検討

### アプローチA: ランタイム取得（SPA直接呼び出し）

#### 概要

書籍詳細画面の表示時にブラウザからAPIを呼び出し、外部書誌情報を動的に取得・表示する。

#### 利用可能なAPI（CORS対応のもの）

| 優先度 | API | 用途 |
|--------|-----|------|
| 1位 | **openBD** | あらすじ・書影・出版情報 |
| 2位 | **Google Books** | openBDで取得できない書籍の補完 |
| 補完 | **NDL Searchサムネイル** | 書影URLをimgタグで直接参照 |

#### 実装フロー

```
書籍詳細画面を開く
  ↓
ISBNがあるか確認
  ↓ あり
ISBN-10 → ISBN-13 変換（フロントエンド側で計算）
  ↓
openBD に問い合わせ
  ↓ データあり              ↓ データなし（null返却）
openBDデータを表示    Google Books APIに問い合わせ
                           ↓
                      データあり → 表示
                      データなし → 「外部情報なし」表示
  ↓
書影が取得できない場合 → NDL Searchサムネイル URLで代替
```

#### メリット

- 実装がシンプル（process.js の変更不要）
- 常に最新の書誌情報を取得できる
- APIキー（Google Books）はビルド時に公開されない

#### デメリット・制約

- ページ表示ごとにAPIリクエストが発生する（表示遅延）
- Google Books の1,000件/日制限が閲覧数によっては問題になり得る
- APIキーをフロントエンドに含める必要があり、完全な秘匿は困難
- CORS非対応のNDL Search・楽天ブックスは利用不可

---

### アプローチB: ビルド時事前取得（スクリプトによるデータ埋め込み）

#### 概要

`node scripts/enrich.js` のようなスクリプトを実行し、外部APIから書誌情報を取得して
JSONファイルに事前保存する。SPAはAPIを直接呼び出さず、保存済みデータを参照する。

#### 利用可能なAPI（Node.jsからはCORS制約なし・全API利用可）

| 優先度 | API | 用途 |
|--------|-----|------|
| 1位 | **openBD** | 主力。バルク取得（100件/リクエスト）。812冊を9リクエストで完了 |
| 2位 | **NDL Search** | openBDでカバーされない書籍の補完。NDC分類・ページ数など |
| 3位 | **Google Books** | あらすじ・ジャンル分類。1,000件/日制限あり |
| 4位 | **楽天ブックス** | フリガナ・あらすじ補完。楽天ブランド表示義務に注意 |

#### データ保存先の選択肢

**選択肢1: `data/books.json` に直接追記する**

現在の `books.json` のスキーマに書誌情報フィールドを追加する。

```json
{
  "id": "4774129844",
  "title": "...",
  "isbn": "4774129844",
  "synopsis": "あらすじテキスト...",
  "coverUrl": "https://...",
  "publishedDate": "2009-09",
  "externalDataSources": ["openbd"]
}
```

- メリット: SPAが参照するファイルが1つで済む、追加のfetchが不要
- デメリット: ファイルサイズ増大（現状比 5〜10倍程度の可能性）、process.jsとの再生成の兼ね合い

**選択肢2: `data/book-metadata.json` を別ファイルとして作成する**

外部書誌情報を独立したファイルに保存し、ISBNをキーとしたマップ構造にする。

```json
{
  "9784774129846": {
    "synopsis": "あらすじテキスト...",
    "coverUrl": "https://...",
    "publishedDate": "2009-09",
    "sources": ["openbd"]
  },
  ...
}
```

- メリット: `books.json` のスキーマを変えない、`process.js` の再生成で外部データが消えない
- デメリット: SPAが起動時に2ファイルをfetchする必要がある

**推奨: 選択肢2（別ファイル）**
`process.js` は `books.json` を毎回再生成するため、書誌情報を `books.json` に埋め込むと
`process.js` 実行のたびに消失する。別ファイルとして管理する方が安全で独立性も高い。

#### 増分更新（インクリメンタル更新）の仕組み

毎回全件取得すると時間とAPIコール数を無駄にするため、差分取得の仕組みを設ける。

```
enrich.js 実行時
  ↓
data/book-metadata.json を読み込む（存在しなければ空マップ）
  ↓
books.json の全書籍を走査
  ↓
metadata に未登録のISBNのみを対象に絞り込む
  ↓
openBD で100件バルク取得
  ↓
NDL Search / Google Books で補完（取得できなかった書籍のみ）
  ↓
book-metadata.json に追記・保存
```

`--force` フラグで全件再取得も可能にする。

#### レート制限の管理（Node.jsスクリプト）

| API | 対策 |
|-----|------|
| openBD | バルク100件/リクエスト → 812冊を9リクエストで完了。制限なしのため並列可 |
| NDL Search | 1件ずつ、200〜500msのwaitを挟む |
| Google Books | 1件ずつ、1,000件/日の制限内に収まるよう1日1回実行を推奨 |
| 楽天ブックス | 1件ずつ、500ms以上のwaitを挟む |

#### メリット

- 全APIが利用可能（CORS制約なし）
- データ取得コストがゼロ（サーバーがいらないという意味でのゼロ）
- SPAの表示が高速（外部APIリクエスト不要）
- APIキーを環境変数として管理でき、フロントエンドに露出しない
- 増分更新により、追加書籍分のみ効率的に取得できる

#### デメリット・制約

- データが静的なため、APIで新しい情報が公開されても自動更新されない（再実行が必要）
- スクリプト実行環境が必要（CI/CDまたはローカル実行）

---

## 両アプローチの比較

| 観点 | A. ランタイム取得 | B. ビルド時事前取得 |
|------|:---:|:---:|
| 実装コスト | 低い | 中程度 |
| 表示速度 | 遅い（API待機） | 速い（静的データ） |
| データの鮮度 | 常に最新 | スクリプト実行時点 |
| APIキーの秘匿性 | 困難（フロントに露出） | 可能（環境変数） |
| 利用できるAPI | CORS対応のみ | 全API |
| データ網羅性 | 中（CORS対応APIのみ） | 高（全API組み合わせ） |
| オフライン閲覧 | 不可 | 可 |
| 初期実装のシンプルさ | 高い | やや複雑 |

---

## 推奨方針

**主軸はアプローチB（ビルド時事前取得）とし、アプローチAを補完的に組み合わせる。**

### 実装ステップ案

1. **フェーズ1: openBD による書影・あらすじの事前取得**
   - `scripts/enrich.js` を新規作成
   - openBD バルクAPIで812冊のデータを一括取得（9リクエスト）
   - `data/book-metadata.json` に保存
   - SPAは `book-metadata.json` を参照して書影・あらすじを表示

2. **フェーズ2: 補完APIの追加**
   - openBDで取得できなかった書籍をNDL SearchおよびGoogle Books Apiで補完
   - 書影フォールバック: NDL Searchサムネイル URL をセット

3. **フェーズ3（オプション）: ランタイム取得による動的補完**
   - `book-metadata.json` にデータがない書籍に対してのみ、ランタイムでopenBD/Google Booksに問い合わせる
   - キャッシュ済みデータを優先することでAPIコールを最小化

---

## ISBN-10 → ISBN-13 変換について

現在の `books.json` のISBNはすべてISBN-10形式。openBD等はISBN-13を要求するため変換が必要。

**変換ルール:**
1. プレフィックス `978` を先頭に付加し、末尾チェックディジット（1桁）を除いた12桁を作成
2. 12桁に対してISBN-13のチェックディジットを計算して付加

```js
function isbn10to13(isbn10) {
  const digits = '978' + isbn10.slice(0, 9);
  const weights = [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3];
  const sum = digits.split('').reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
  const check = (10 - (sum % 10)) % 10;
  return digits + check;
}
```

---

## 参考リンク

- [openBD プロジェクト](https://openbd.jp/)
- [openBD API仕様](https://openbd.jp/#api-spec)
- [NDL Search API仕様書](https://ndlsearch.ndl.go.jp/help/api/specifications)
- [NDL Search サムネイルAPI](https://ndlsearch.ndl.go.jp/help/api/thumbnail)
- [Google Books API ドキュメント](https://developers.google.com/books/docs/v1/using)
- [CiNii Books OpenSearch API](https://support.nii.ac.jp/en/cib/api/b_opensearch)
- [楽天ブックス書籍検索API](https://webservice.rakuten.co.jp/documentation/books-book-search)
