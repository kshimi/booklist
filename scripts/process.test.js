'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const {
  parseCSV,
  filterRecords,
  parseFilename,
  extractAuthorFromTitle,
  applyBookCorrections,
  normalizeAuthor,
  resolveAuthorAlias,
  parseOfflineCsv,
  estimateGenre,
  estimateSubgenre,
  deduplicateBooks,
  generateId,
  OFFLINE_GENRE_MAP,
} = require('./process.js');

// ---------------------------------------------------------------------------
// parseFilename
// ---------------------------------------------------------------------------

describe('parseFilename', () => {
  test('T-01: extracts title, author, isbn, pages, series from standard filename', () => {
    const r = parseFilename('あるタイトル（シリーズA）山田太郎 186p_9784101020112.pdf');
    assert.equal(r.title, 'あるタイトル');
    assert.equal(r.author, '山田太郎');
    assert.equal(r.isbn, '9784101020112');
    assert.equal(r.pages, 186);
    assert.equal(r.series, 'シリーズA');
    assert.equal(r.version, 'original');
  });

  test('T-02: detects kindle version and removes kindlep_ prefix', () => {
    const r = parseFilename('kindlep_あるタイトル 山田太郎 200p_9784101020112.pdf');
    assert.equal(r.version, 'kindle');
    assert.equal(r.isbn, '9784101020112');
    assert.equal(r.pages, 200);
    assert.ok(!r.title.includes('kindlep_'), 'Title must not contain prefix');
  });

  test('T-03: detects ipad3 version with null isbn and pages', () => {
    const r = parseFilename('ipad3_あるタイトル 山田太郎.pdf');
    assert.equal(r.version, 'ipad3');
    assert.equal(r.isbn, null);
    assert.equal(r.pages, null);
  });

  test('T-04: original version with null isbn and pages', () => {
    const r = parseFilename('タイトル著者名.pdf');
    assert.equal(r.version, 'original');
    assert.equal(r.isbn, null);
    assert.equal(r.pages, null);
  });

  test('T-05: joins multiple series names with ／', () => {
    const r = parseFilename('あるタイトル（シリーズA）（シリーズB）山田太郎 100p_1234567890.pdf');
    assert.equal(r.series, 'シリーズA／シリーズB');
    assert.equal(r.isbn, '1234567890');
    assert.equal(r.pages, 100);
  });

  test('T-06: no isbn and no series result in null values', () => {
    const r = parseFilename('あるタイトル 山田太郎 186p.pdf');
    assert.equal(r.isbn, null);
    assert.equal(r.series, null);
  });

  test('kindlepw_ prefix is treated as kindle version', () => {
    const r = parseFilename('kindlepw_あるタイトル（シリーズ）山田太郎 200p_4253171176.pdf');
    assert.equal(r.version, 'kindle');
    assert.ok(!r.title.includes('kindlepw_'));
  });

  test('author is extracted after last closing bracket', () => {
    const r = parseFilename('タイトル （新潮文庫） 著者名 300p_4101235058.pdf');
    assert.equal(r.author, '著者名');
    assert.equal(r.series, '新潮文庫');
    assert.equal(r.title, 'タイトル');
  });

  test('P-A: extracts Western name at end of Japanese title (no brackets)', () => {
    const r = parseFilename('SQLアンチパターン Bill Karwin.pdf');
    assert.equal(r.title, 'SQLアンチパターン');
    assert.equal(r.author, 'Bill Karwin');
  });

  test('P-A: extracts multi-word Western name after Japanese title', () => {
    const r = parseFilename('UNIXシェルプログラミング Lowell Jay Arthur.pdf');
    assert.equal(r.title, 'UNIXシェルプログラミング');
    assert.equal(r.author, 'Lowell Jay Arthur');
  });

  test('P-B: extracts kanji name at end of title (no brackets)', () => {
    const r = parseFilename('Schemeによる記号処理入門 猪股 俊光.pdf');
    assert.equal(r.title, 'Schemeによる記号処理入門');
    assert.equal(r.author, '猪股 俊光');
  });

  test('P-B: extracts kanji name after katakana/mixed title', () => {
    const r = parseFilename('iPhoneiPadiPod touchプログラミングバイブル-iOS 5Xcode 4対応 smart phone programming bible 布留川 英一.pdf');
    assert.equal(r.author, '布留川 英一');
  });

  test('no auto-extraction for all-English title without Japanese chars', () => {
    const r = parseFilename('Joel on Software Joel Spolsky.pdf');
    assert.equal(r.title, 'Joel on Software Joel Spolsky');
    assert.equal(r.author, '');
  });

  test('no auto-extraction for katakana-only author at end (P2 not supported)', () => {
    const r = parseFilename('GNU Emacs デブラ キャメロン.pdf');
    assert.equal(r.title, 'GNU Emacs デブラ キャメロン');
    assert.equal(r.author, '');
  });
});

// ---------------------------------------------------------------------------
// extractAuthorFromTitle
// ---------------------------------------------------------------------------

describe('extractAuthorFromTitle', () => {
  test('P-A: returns title and Western author for Japanese+Latin title', () => {
    const result = extractAuthorFromTitle('SQLアンチパターン Bill Karwin');
    assert.deepEqual(result, { title: 'SQLアンチパターン', author: 'Bill Karwin' });
  });

  test('P-A: returns null for all-English title (no Japanese chars)', () => {
    assert.equal(extractAuthorFromTitle('Joel on Software Joel Spolsky'), null);
  });

  test('P-A: returns null for Japanese title ending in katakana (not Title Case Latin)', () => {
    assert.equal(extractAuthorFromTitle('GNU Emacs デブラ キャメロン'), null);
  });

  test('P-B: returns title and kanji author for mixed title with kanji name', () => {
    const result = extractAuthorFromTitle('Schemeによる記号処理入門 猪股 俊光');
    assert.deepEqual(result, { title: 'Schemeによる記号処理入門', author: '猪股 俊光' });
  });

  test('P-B: rejects match ending with 訳 (non-name suffix)', () => {
    assert.equal(extractAuthorFromTitle('科学は不確かだ！ R．P．ファインマン 著 大貫 昌子 訳'), null);
  });

  test('P-B: rejects match ending with 著 (non-name suffix)', () => {
    assert.equal(extractAuthorFromTitle('タイトル 著者 著'), null);
  });

  test('P-B: returns null when given name exceeds 2 kanji', () => {
    // 出版社名 3 kanji given → should not match
    assert.equal(extractAuthorFromTitle('モンゴル 遊牧の四季 三秋尚 鉱脈社'), null);
  });

  test('returns null for title with no extractable author pattern', () => {
    assert.equal(extractAuthorFromTitle('Rubyベストプラクティス'), null);
  });
});

// ---------------------------------------------------------------------------
// applyBookCorrections
// ---------------------------------------------------------------------------

describe('applyBookCorrections', () => {
  const corrections = [
    { original_title: 'GNU Emacs デブラ キャメロン', title: 'GNU Emacs', author: 'デブラ・キャメロン' },
    { original_title: 'Rubyベストプラクティス', title: 'Rubyベストプラクティス', author: 'Jeremy McAnally' },
  ];

  test('returns corrected title and author when original_title matches', () => {
    const result = applyBookCorrections('GNU Emacs デブラ キャメロン', '', null, null, corrections);
    assert.deepEqual(result, { title: 'GNU Emacs', author: 'デブラ・キャメロン', pages: null, isbn: null });
  });

  test('returns unchanged title and author when no match found', () => {
    const result = applyBookCorrections('存在しないタイトル', '著者名', null, null, corrections);
    assert.deepEqual(result, { title: '存在しないタイトル', author: '著者名', pages: null, isbn: null });
  });

  test('returns unchanged when corrections array is empty', () => {
    const result = applyBookCorrections('GNU Emacs デブラ キャメロン', '', null, null, []);
    assert.deepEqual(result, { title: 'GNU Emacs デブラ キャメロン', author: '', pages: null, isbn: null });
  });

  test('correction with empty author field keeps author empty', () => {
    const result = applyBookCorrections('Rubyベストプラクティス', '', null, null, [
      { original_title: 'Rubyベストプラクティス', title: 'Rubyベストプラクティス', author: '' },
    ]);
    assert.deepEqual(result, { title: 'Rubyベストプラクティス', author: '', pages: null, isbn: null });
  });

  test('correction with pages and isbn overrides parsed null values', () => {
    const result = applyBookCorrections('雪国 川端 康成 208p_4101001014', '', null, null, [
      { original_title: '雪国 川端 康成 208p_4101001014', title: '雪国', author: '川端康成', pages: 208, isbn: '4101001014' },
    ]);
    assert.deepEqual(result, { title: '雪国', author: '川端康成', pages: 208, isbn: '4101001014' });
  });

  test('correction without pages/isbn keys keeps parsed values', () => {
    const result = applyBookCorrections('GNU Emacs デブラ キャメロン', '', 300, '1234567890', corrections);
    assert.deepEqual(result, { title: 'GNU Emacs', author: 'デブラ・キャメロン', pages: 300, isbn: '1234567890' });
  });

  test('correction with explicit null pages/isbn overrides non-null parsed values', () => {
    const result = applyBookCorrections('タイトル', '著者', 300, '1234567890', [
      { original_title: 'タイトル', title: 'タイトル', author: '著者', pages: null, isbn: null },
    ]);
    assert.deepEqual(result, { title: 'タイトル', author: '著者', pages: null, isbn: null });
  });
});

// ---------------------------------------------------------------------------
// normalizeAuthor
// ---------------------------------------------------------------------------

describe('normalizeAuthor', () => {
  test('replaces single space with nakaguro (2-word 姓名 format)', () => {
    assert.equal(normalizeAuthor('アイザック アシモフ'), 'アイザック・アシモフ');
  });

  test('converts full-width periods to half-width periods', () => {
    assert.equal(normalizeAuthor('J．R．R．トールキン'), 'J.R.R.トールキン');
  });

  test('converts full-width periods then replaces single space with nakaguro', () => {
    assert.equal(normalizeAuthor('J．R．R． トールキン'), 'J.R.R.・トールキン');
  });

  test('removes space for Japanese kanji names without adding nakaguro', () => {
    assert.equal(normalizeAuthor('山田 太郎'), '山田太郎');
  });

  test('removes space for kanji+hiragana names (e.g. 太宰 治)', () => {
    assert.equal(normalizeAuthor('太宰 治'), '太宰治');
  });

  test('does not replace space when more than one space exists', () => {
    assert.equal(normalizeAuthor('アーサー コナン ドイル'), 'アーサー コナン ドイル');
  });

  test('trims leading and trailing whitespace', () => {
    assert.equal(normalizeAuthor('  著者名  '), '著者名');
  });

  test('leaves name unchanged when no normalization needed', () => {
    assert.equal(normalizeAuthor('アイザック・アシモフ'), 'アイザック・アシモフ');
  });
});

// ---------------------------------------------------------------------------
// resolveAuthorAlias
// ---------------------------------------------------------------------------

describe('resolveAuthorAlias', () => {
  const aliases = { 'J.R.R.・トールキン': 'J.R.R.トールキン' };

  test('returns canonical name when alias exists', () => {
    assert.equal(resolveAuthorAlias('J.R.R.・トールキン', aliases), 'J.R.R.トールキン');
  });

  test('returns original name when no alias found', () => {
    assert.equal(resolveAuthorAlias('アイザック・アシモフ', aliases), 'アイザック・アシモフ');
  });

  test('returns original name when alias map is empty', () => {
    assert.equal(resolveAuthorAlias('著者名', {}), '著者名');
  });
});

// ---------------------------------------------------------------------------
// estimateGenre
// ---------------------------------------------------------------------------

describe('estimateGenre', () => {
  test('T-10: SF folder path', () => {
    assert.equal(estimateGenre('70_Book / SF / 海外'), 'SF');
  });

  test('T-11: ノンフィクション folder path', () => {
    assert.equal(estimateGenre('70_Book / ノンフィクション'), 'ノンフィクション');
  });

  test('T-12: フィクション folder path', () => {
    assert.equal(estimateGenre('70_Book / フィクション'), 'フィクション');
  });

  test('T-13: ノンフィクション has higher priority than フィクション', () => {
    assert.equal(estimateGenre('70_Book / フィクション / ノンフィクション'), 'ノンフィクション');
  });

  test('T-14: 日本の作家 → フィクション（日本）', () => {
    assert.equal(estimateGenre('70_Book / 日本の作家'), 'フィクション（日本）');
  });

  test('T-15: no keyword match in folder or title → 未分類', () => {
    assert.equal(estimateGenre('70_Book', '無題', '著者', null), '未分類');
  });

  test('T-16: fallback to コンピュータ via title keyword 人工知能', () => {
    assert.equal(estimateGenre('70_Book', '人工知能概論', '著者', null), 'コンピュータ');
  });

  test('T-17: fallback to ノンフィクション via title keyword 自伝', () => {
    assert.equal(estimateGenre('70_Book', 'フランクリン自伝', 'フランクリン', '岩波文庫'), 'ノンフィクション');
  });

  test('T-18: fallback to エッセイ via title keyword 日記', () => {
    assert.equal(estimateGenre('70_Book', 'アンネの日記', 'アンネ・フランク', '文春文庫'), 'エッセイ');
  });

  test('T-19: fallback to フィクション（日本）via title keyword 百人一首', () => {
    assert.equal(estimateGenre('70_Book', '小倉百人一首', '', null), 'フィクション（日本）');
  });

  test('folder path match takes precedence over fallback', () => {
    assert.equal(estimateGenre('70_Book / フィクション', '自伝', '著者', null), 'フィクション');
  });

  test('エッセイ path', () => {
    assert.equal(estimateGenre('70_Book / エッセイ'), 'エッセイ');
  });

  test('漫画 path', () => {
    assert.equal(estimateGenre('70_Book / 漫画'), '漫画・コミック');
  });

  test("O'Reilly path → コンピュータ", () => {
    assert.equal(estimateGenre("70_Book / O'Reilly Japan"), 'コンピュータ');
  });

  test('運転関係 path', () => {
    assert.equal(estimateGenre('70_Book / 運転関係'), '運転');
  });
});

// ---------------------------------------------------------------------------
// estimateSubgenre
// ---------------------------------------------------------------------------

describe('estimateSubgenre', () => {
  test('T-50: フィクション title containing 探偵 → ミステリー', () => {
    assert.equal(estimateSubgenre('フィクション', '名探偵の帰還', 'コナン', null), 'ミステリー');
  });

  test('T-51: フィクション non-mystery title → その他フィクション', () => {
    assert.equal(estimateSubgenre('フィクション', 'ある婦人の肖像', 'ジェイムズ', null), 'その他フィクション');
  });

  test('T-52: フィクション（日本）title containing 推理 → ミステリー', () => {
    assert.equal(estimateSubgenre('フィクション（日本）', '推理小説集', '著者', null), 'ミステリー');
  });

  test('T-53: フィクション（日本）historical title → 歴史・時代', () => {
    assert.equal(estimateSubgenre('フィクション（日本）', '幕末の武士道', '著者', null), '歴史・時代');
  });

  test('T-54: フィクション（日本）plain title → その他フィクション', () => {
    assert.equal(estimateSubgenre('フィクション（日本）', 'きりぎりす', '太宰 治', null), 'その他フィクション');
  });

  test('T-55: ノンフィクション title containing 科学 → 科学・技術', () => {
    assert.equal(estimateSubgenre('ノンフィクション', '科学は不確かだ！', 'ファインマン', null), '科学・技術');
  });

  test('T-56: ノンフィクション title containing 哲学 → 哲学・思想', () => {
    assert.equal(estimateSubgenre('ノンフィクション', '哲学入門', '著者', null), '哲学・思想');
  });

  test('T-57: ノンフィクション biography title → 歴史・伝記', () => {
    assert.equal(estimateSubgenre('ノンフィクション', 'フランクリン自伝', 'フランクリン', null), '歴史・伝記');
  });

  test('T-58: ノンフィクション social title → 社会・経済', () => {
    assert.equal(estimateSubgenre('ノンフィクション', '資本主義の終焉', '著者', null), '社会・経済');
  });

  test('T-59: ノンフィクション uncategorized → その他ノンフィクション', () => {
    assert.equal(estimateSubgenre('ノンフィクション', '旅の日々', '著者', null), 'その他ノンフィクション');
  });

  test('T-60: SF has no subgenre rules → null', () => {
    assert.equal(estimateSubgenre('SF', '夏への扉', '著者', null), null);
  });

  test('T-61: エッセイ has no subgenre rules → null', () => {
    assert.equal(estimateSubgenre('エッセイ', '旅日記', '著者', null), null);
  });
});

// ---------------------------------------------------------------------------
// filterRecords
// ---------------------------------------------------------------------------

describe('filterRecords', () => {
  function makeRow(filename, mimeType = 'application/pdf') {
    return {
      'ファイル名': filename,
      'MIME タイプ': mimeType,
      'フォルダパス': '70_Book',
      'ファイルURL': '',
      'ファイルID': '',
      'ファイルサイズ (MB)': '1',
    };
  }

  test('T-20: excludes non-PDF files', () => {
    assert.equal(filterRecords([makeRow('test.txt', 'text/plain')]).length, 0);
  });

  test('T-21: excludes self_check files', () => {
    assert.equal(filterRecords([makeRow('self_check.pdf')]).length, 0);
  });

  test('T-22: excludes 20120330_1246_33_0706 files', () => {
    assert.equal(filterRecords([makeRow('20120330_1246_33_0706.pdf')]).length, 0);
  });

  test('T-22b: excludes to_1733_912_003_5_at files', () => {
    assert.equal(filterRecords([makeRow('to_1733_912_003_5_at.pdf')]).length, 0);
  });

  test('T-23: allows valid PDF files', () => {
    assert.equal(filterRecords([makeRow('valid_book.pdf')]).length, 1);
  });

  test('filters out multiple non-PDF rows while keeping PDFs', () => {
    const rows = [
      makeRow('book.pdf', 'application/pdf'),
      makeRow('doc.txt', 'text/plain'),
      makeRow('self_check.pdf', 'application/pdf'),
    ];
    assert.equal(filterRecords(rows).length, 1);
  });
});

// ---------------------------------------------------------------------------
// deduplicateBooks
// ---------------------------------------------------------------------------

describe('deduplicateBooks', () => {
  function makeFile(overrides) {
    return {
      title: 'テスト本',
      author: '著者',
      isbn: null,
      pages: 100,
      series: null,
      version: 'original',
      genre: 'フィクション',
      file_url: 'https://example.com',
      file_id: 'abc123',
      ...overrides,
    };
  }

  test('T-34: merged book has subgenre derived from genre and title', () => {
    const files = [makeFile({ genre: 'ノンフィクション', title: '科学の世界', isbn: '9784101020112' })];
    const books = deduplicateBooks(files);
    assert.equal(books[0].subgenre, '科学・技術');
  });

  test('T-35: merged book with SF genre has null subgenre', () => {
    const files = [makeFile({ genre: 'SF', title: '宇宙SF大全' })];
    const books = deduplicateBooks(files);
    assert.equal(books[0].subgenre, null);
  });

  test('T-30: merges same-ISBN books into one record with both versions', () => {
    const files = [
      makeFile({ isbn: '9784101020112', version: 'original', file_url: 'https://example.com/orig', file_id: 'orig_id' }),
      makeFile({ isbn: '9784101020112', version: 'kindle', file_url: 'https://example.com/kindle', file_id: 'kindle_id' }),
    ];
    const books = deduplicateBooks(files);
    assert.equal(books.length, 1);
    assert.ok(books[0].versions.includes('original'));
    assert.ok(books[0].versions.includes('kindle'));
    assert.equal(books[0].version_files['original'].file_url, 'https://example.com/orig');
    assert.equal(books[0].version_files['kindle'].file_url, 'https://example.com/kindle');
    assert.equal(books[0].version_files['original'].file_id, 'orig_id');
    assert.equal(books[0].version_files['kindle'].file_id, 'kindle_id');
  });

  test('T-31: merges same-title books (no ISBN) into one record', () => {
    const files = [
      makeFile({ isbn: null, title: '同じ本', version: 'original', file_url: 'https://example.com/orig', file_id: 'orig_id' }),
      makeFile({ isbn: null, title: '同じ本', version: 'ipad3', file_url: 'https://example.com/ipad3', file_id: 'ipad3_id' }),
    ];
    const books = deduplicateBooks(files);
    assert.equal(books.length, 1);
    assert.ok(books[0].versions.includes('original'));
    assert.ok(books[0].versions.includes('ipad3'));
    assert.equal(books[0].version_files['original'].file_url, 'https://example.com/orig');
    assert.equal(books[0].version_files['original'].file_id, 'orig_id');
    assert.equal(books[0].version_files['ipad3'].file_url, 'https://example.com/ipad3');
    assert.equal(books[0].version_files['ipad3'].file_id, 'ipad3_id');
  });

  test('T-32: picks higher-priority genre when merging versions', () => {
    const files = [
      makeFile({ isbn: '9784101020112', version: 'original', genre: 'フィクション' }),
      makeFile({ isbn: '9784101020112', version: 'kindle', genre: 'SF' }),
    ];
    const books = deduplicateBooks(files);
    assert.equal(books[0].genre, 'SF');
  });

  test('T-33: uses first record values when no original version exists', () => {
    const files = [
      makeFile({ isbn: '9784101020112', version: 'kindle', title: 'Kindle本', author: 'Kindle著者' }),
    ];
    const books = deduplicateBooks(files);
    assert.equal(books[0].title, 'Kindle本');
    assert.equal(books[0].author, 'Kindle著者');
  });

  test('prefers original version title and author over kindle', () => {
    const files = [
      makeFile({ isbn: '9784101020112', version: 'kindle', title: 'Kindle本', author: 'Kindle著者' }),
      makeFile({ isbn: '9784101020112', version: 'original', title: 'Original本', author: 'Original著者' }),
    ];
    const books = deduplicateBooks(files);
    assert.equal(books[0].title, 'Original本');
    assert.equal(books[0].author, 'Original著者');
  });

  test('picks non-null pages from any version when merging by ISBN', () => {
    const files = [
      makeFile({ isbn: '9784101020112', pages: null, version: 'original', title: '本A' }),
      makeFile({ isbn: '9784101020112', pages: 200, version: 'kindle', title: '本A' }),
    ];
    const books = deduplicateBooks(files);
    assert.equal(books.length, 1);
    assert.equal(books[0].pages, 200);
  });

  test('source is google_drive when all records have source google_drive', () => {
    const files = [
      makeFile({ isbn: '9784101020112', version: 'original', source: 'google_drive' }),
      makeFile({ isbn: '9784101020112', version: 'kindle', source: 'google_drive' }),
    ];
    const books = deduplicateBooks(files);
    assert.equal(books[0].source, 'google_drive');
  });

  test('source is paper when record has source paper', () => {
    const files = [makeFile({ version: null, source: 'paper' })];
    const books = deduplicateBooks(files);
    assert.equal(books[0].source, 'paper');
  });

  test('source is array when google_drive and paper records share the same key', () => {
    const files = [
      makeFile({ isbn: '9784101020112', version: 'original', source: 'google_drive', file_url: 'https://example.com/orig', file_id: 'orig_id' }),
      makeFile({ isbn: '9784101020112', version: null, source: 'paper', file_url: null, file_id: null }),
    ];
    const books = deduplicateBooks(files);
    assert.equal(books.length, 1);
    assert.deepEqual(books[0].source, ['google_drive', 'paper']);
  });

  test('paper record has empty versions and version_files', () => {
    const files = [makeFile({ version: null, source: 'paper', file_url: null, file_id: null })];
    const books = deduplicateBooks(files);
    assert.deepEqual(books[0].versions, []);
    assert.deepEqual(books[0].version_files, {});
  });

  test('google_drive record has versions populated', () => {
    const files = [makeFile({ version: 'original', source: 'google_drive' })];
    const books = deduplicateBooks(files);
    assert.deepEqual(books[0].versions, ['original']);
  });

  test('defaults source to google_drive when no source is set (backward compat)', () => {
    const files = [makeFile({ version: 'original' })];
    const books = deduplicateBooks(files);
    assert.equal(books[0].source, 'google_drive');
  });
});

// ---------------------------------------------------------------------------
// parseOfflineCsv
// ---------------------------------------------------------------------------

describe('parseOfflineCsv', () => {
  function makeOfflineCsv(rows) {
    const header = 'ジャンル,書名,著者名,出版社';
    return [header, ...rows].join('\n') + '\n';
  }

  test('maps コンピュータ・IT技術 to コンピュータ', () => {
    const csv = makeOfflineCsv(['コンピュータ・IT技術,プログラマの数学,結城浩,SBクリエイティブ']);
    const result = parseOfflineCsv(csv, {});
    assert.equal(result[0].genre, 'コンピュータ');
  });

  test('maps 物理・自然科学・農学 to ノンフィクション', () => {
    const csv = makeOfflineCsv(['物理・自然科学・農学,ファインマン物理学,ファインマン,岩波書店']);
    const result = parseOfflineCsv(csv, {});
    assert.equal(result[0].genre, 'ノンフィクション');
  });

  test('maps コミックス to 漫画・コミック', () => {
    const csv = makeOfflineCsv(['コミックス,AKIRA,大友克洋,講談社']);
    const result = parseOfflineCsv(csv, {});
    assert.equal(result[0].genre, '漫画・コミック');
  });

  test('maps 趣味・実用・自動車 to 実用', () => {
    const csv = makeOfflineCsv(['趣味・実用・自動車,ファウンテンペン！,萬年筆研究会,枻出版社']);
    const result = parseOfflineCsv(csv, {});
    assert.equal(result[0].genre, '実用');
  });

  test('unmapped genre falls back to GENRE_FALLBACK_RULES estimation', () => {
    const csv = makeOfflineCsv(['文学・小説・教養,フランクリン自伝,フランクリン,岩波文庫']);
    const result = parseOfflineCsv(csv, {});
    // GENRE_FALLBACK_RULES matches 自伝 → ノンフィクション
    assert.equal(result[0].genre, 'ノンフィクション');
  });

  test('unmapped genre with no keyword match falls back to 未分類', () => {
    const csv = makeOfflineCsv(['文学・小説・教養,夏目漱石集,夏目漱石,講談社']);
    const result = parseOfflineCsv(csv, {});
    // No keyword match → 未分類
    assert.equal(result[0].genre, '未分類');
  });

  test('source is paper for all records', () => {
    const csv = makeOfflineCsv([
      'コンピュータ・IT技術,プログラマの数学,結城浩,SBクリエイティブ',
      'コミックス,AKIRA,大友克洋,講談社',
    ]);
    const result = parseOfflineCsv(csv, {});
    assert.equal(result.length, 2);
    assert.equal(result[0].source, 'paper');
    assert.equal(result[1].source, 'paper');
  });

  test('isbn, pages, series, version are null', () => {
    const csv = makeOfflineCsv(['コンピュータ・IT技術,プログラマの数学,結城浩,SBクリエイティブ']);
    const result = parseOfflineCsv(csv, {});
    assert.equal(result[0].isbn, null);
    assert.equal(result[0].pages, null);
    assert.equal(result[0].series, null);
    assert.equal(result[0].version, null);
  });

  test('applies normalizeAuthor to author name', () => {
    const csv = makeOfflineCsv(['物理・自然科学・農学,テスト本,アイザック アシモフ,出版社']);
    const result = parseOfflineCsv(csv, {});
    // normalizeAuthor converts single space to nakaguro for katakana names
    assert.equal(result[0].author, 'アイザック・アシモフ');
  });

  test('applies resolveAuthorAlias using provided alias map', () => {
    const aliases = { 'ファインマン': 'R.P.ファインマン' };
    const csv = makeOfflineCsv(['物理・自然科学・農学,テスト本,ファインマン,岩波書店']);
    const result = parseOfflineCsv(csv, aliases);
    assert.equal(result[0].author, 'R.P.ファインマン');
  });

  test('sets title and author from CSV fields', () => {
    const csv = makeOfflineCsv(['コンピュータ・IT技術,プログラマの数学,結城浩,SBクリエイティブ']);
    const result = parseOfflineCsv(csv, {});
    assert.equal(result[0].title, 'プログラマの数学');
    assert.equal(result[0].author, '結城浩');
  });
});

// ---------------------------------------------------------------------------
// generateId
// ---------------------------------------------------------------------------

describe('generateId', () => {
  test('uses isbn as id when available', () => {
    const book = { isbn: '9784101020112', title: '本' };
    assert.equal(generateId(book), '9784101020112');
  });

  test('generates title_XXXX id when isbn is null', () => {
    const book = { isbn: null, title: 'テストタイトル' };
    const id = generateId(book);
    assert.ok(id.startsWith('title_'), `Expected title_ prefix, got ${id}`);
  });

  test('generates same id for same title (stable)', () => {
    const book = { isbn: null, title: 'テストタイトル' };
    assert.equal(generateId(book), generateId(book));
  });
});

// ---------------------------------------------------------------------------
// parseCSV
// ---------------------------------------------------------------------------

describe('parseCSV', () => {
  test('parses simple CSV with header', () => {
    const csv = 'name,value\nAlice,1\nBob,2\n';
    const rows = parseCSV(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, 'Alice');
    assert.equal(rows[1].value, '2');
  });

  test('handles quoted fields containing commas', () => {
    const csv = 'a,b\n"hello, world",42\n';
    const rows = parseCSV(csv);
    assert.equal(rows[0].a, 'hello, world');
  });

  test('handles quoted fields containing newlines', () => {
    const csv = 'a,b\n"line1\nline2",99\n';
    const rows = parseCSV(csv);
    assert.equal(rows[0].a, 'line1\nline2');
    assert.equal(rows[0].b, '99');
  });
});

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe('Integration', () => {
  const csvPath = path.join(__dirname, '..', 'data', 'booklist.csv');
  const offlineCsvPath = path.join(__dirname, '..', 'data', 'offline_bibliography_list.csv');
  const csvExists = fs.existsSync(csvPath);
  const offlineCsvExists = fs.existsSync(offlineCsvPath);

  function loadBooks() {
    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvText);
    const filtered = filterRecords(rows);
    const driveFiles = filtered.map(row => {
      const parsed = parseFilename(row['ファイル名'] || '');
      const genre = estimateGenre(row['フォルダパス'] || '', parsed.title, parsed.author, parsed.series);
      return {
        ...parsed,
        genre,
        folder_path: row['フォルダパス'] || '',
        file_url: row['ファイルURL'] || '',
        file_id: row['ファイルID'] || '',
        file_size_mb: parseFloat(row['ファイルサイズ (MB)'] || '0'),
        source: 'google_drive',
      };
    });
    const offlineFiles = offlineCsvExists
      ? parseOfflineCsv(fs.readFileSync(offlineCsvPath, 'utf-8'), {})
      : [];
    return deduplicateBooks([...driveFiles, ...offlineFiles]);
  }

  test('T-40: processes booklist.csv and produces 819 unique Google Drive books', () => {
    if (!csvExists) {
      console.log('Skipping T-40: booklist.csv not found');
      return;
    }
    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvText);
    const filtered = filterRecords(rows);
    const driveFiles = filtered.map(row => {
      const parsed = parseFilename(row['ファイル名'] || '');
      const genre = estimateGenre(row['フォルダパス'] || '', parsed.title, parsed.author, parsed.series);
      return { ...parsed, genre, folder_path: row['フォルダパス'] || '', file_url: row['ファイルURL'] || '', file_id: row['ファイルID'] || '', file_size_mb: 0, source: 'google_drive' };
    });
    const books = deduplicateBooks(driveFiles);
    assert.equal(books.length, 819, `Expected 819 books, got ${books.length}`);
  });

  test('T-40b: total book count increases when offline CSV is included', () => {
    if (!csvExists || !offlineCsvExists) {
      console.log('Skipping T-40b: data files not found');
      return;
    }
    const books = loadBooks();
    assert.equal(books.length, 882, `Expected 882 books with offline data, got ${books.length}`);
  });

  test('T-41: all book records have required fields', () => {
    if (!csvExists) return;
    const books = loadBooks();
    for (const book of books) {
      assert.ok(typeof book.title === 'string', 'title must be a string');
      assert.ok(typeof book.author === 'string', 'author must be a string');
      assert.ok(typeof book.genre === 'string', 'genre must be a string');
      assert.ok(book.subgenre === null || typeof book.subgenre === 'string', 'subgenre must be string or null');
      assert.ok(Array.isArray(book.versions), 'versions must be an array');
      assert.ok(typeof book.version_files === 'object' && book.version_files !== null, 'version_files must be an object');
      for (const v of book.versions) {
        assert.ok(book.version_files[v], `version_files must have entry for version "${v}"`);
        assert.ok(typeof book.version_files[v].file_url === 'string', `version_files[${v}].file_url must be a string`);
        assert.ok(typeof book.version_files[v].file_id === 'string', `version_files[${v}].file_id must be a string`);
      }
      const validSource = book.source === 'google_drive' || book.source === 'paper' ||
        (Array.isArray(book.source) && book.source.includes('google_drive') && book.source.includes('paper'));
      assert.ok(validSource, `source must be a valid value, got ${JSON.stringify(book.source)}`);
    }
  });

  test('T-41b: paper books have empty versions and version_files', () => {
    if (!csvExists || !offlineCsvExists) return;
    const books = loadBooks();
    const paperOnly = books.filter(b => b.source === 'paper');
    for (const book of paperOnly) {
      assert.deepEqual(book.versions, [], `Paper book "${book.title}" must have empty versions`);
      assert.deepEqual(book.version_files, {}, `Paper book "${book.title}" must have empty version_files`);
    }
  });

  test('T-43: 未分類 books are fewer than before fallback inference (baseline: 64)', () => {
    if (!csvExists) return;
    const books = loadBooks();
    const unclassified = books.filter(b => b.genre === '未分類').length;
    assert.ok(unclassified < 64, `Expected fewer than 64 未分類 books, got ${unclassified}`);
  });

  test('T-42: no duplicate IDs in generated output', () => {
    if (!csvExists) return;
    const books = loadBooks();
    const ids = books.map(b => generateId(b));
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, `Found ${ids.length - uniqueIds.size} duplicate IDs`);
  });
});
