'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const {
  parseCSV,
  filterRecords,
  parseFilename,
  estimateGenre,
  estimateSubgenre,
  deduplicateBooks,
  generateId,
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
      makeFile({ isbn: '9784101020112', version: 'original' }),
      makeFile({ isbn: '9784101020112', version: 'kindle' }),
    ];
    const books = deduplicateBooks(files);
    assert.equal(books.length, 1);
    assert.ok(books[0].versions.includes('original'));
    assert.ok(books[0].versions.includes('kindle'));
  });

  test('T-31: merges same-title books (no ISBN) into one record', () => {
    const files = [
      makeFile({ isbn: null, title: '同じ本', version: 'original' }),
      makeFile({ isbn: null, title: '同じ本', version: 'ipad3' }),
    ];
    const books = deduplicateBooks(files);
    assert.equal(books.length, 1);
    assert.ok(books[0].versions.includes('original'));
    assert.ok(books[0].versions.includes('ipad3'));
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
  const csvExists = fs.existsSync(csvPath);

  function loadBooks() {
    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvText);
    const filtered = filterRecords(rows);
    const files = filtered.map(row => {
      const parsed = parseFilename(row['ファイル名'] || '');
      const genre = estimateGenre(row['フォルダパス'] || '', parsed.title, parsed.author, parsed.series);
      return {
        ...parsed,
        genre,
        folder_path: row['フォルダパス'] || '',
        file_url: row['ファイルURL'] || '',
        file_id: row['ファイルID'] || '',
        file_size_mb: parseFloat(row['ファイルサイズ (MB)'] || '0'),
      };
    });
    return deduplicateBooks(files);
  }

  test('T-40: processes booklist.csv and produces 819 unique books', () => {
    if (!csvExists) {
      console.log('Skipping T-40: booklist.csv not found');
      return;
    }
    const books = loadBooks();
    assert.equal(books.length, 819, `Expected 819 books, got ${books.length}`);
  });

  test('T-41: all book records have required fields', () => {
    if (!csvExists) return;
    const books = loadBooks();
    for (const book of books) {
      assert.ok(typeof book.title === 'string', 'title must be a string');
      assert.ok(typeof book.author === 'string', 'author must be a string');
      assert.ok(typeof book.genre === 'string', 'genre must be a string');
      assert.ok(book.subgenre === null || typeof book.subgenre === 'string', 'subgenre must be string or null');
      assert.ok(Array.isArray(book.versions) && book.versions.length > 0, 'versions must be non-empty array');
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
