'use strict';

/**
 * List books with empty author fields that are not yet registered in book-corrections.json.
 *
 * Usage:
 *   node scripts/list-missing-authors.js             # List remaining books without authors
 *   node scripts/list-missing-authors.js --generate  # Generate/update data/book-corrections.json
 */

const fs = require('fs');
const path = require('path');

const BOOKS_PATH = path.join(__dirname, '..', 'data', 'books.json');
const CORRECTIONS_PATH = path.join(__dirname, '..', 'data', 'book-corrections.json');

function loadBooks() {
  if (!fs.existsSync(BOOKS_PATH)) {
    console.error(`Error: ${BOOKS_PATH} not found. Run node scripts/process.js first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf-8'));
}

function loadCorrections() {
  if (!fs.existsSync(CORRECTIONS_PATH)) return [];
  return JSON.parse(fs.readFileSync(CORRECTIONS_PATH, 'utf-8')).corrections || [];
}

function listMissing() {
  const books = loadBooks();
  const corrections = loadCorrections();
  // Include both original_title and title so that entries where the correction
  // changes the title (original_title !== title) are still recognized after
  // process.js has written the corrected title into books.json.
  const registeredTitles = new Set([
    ...corrections.map(c => c.original_title),
    ...corrections.map(c => c.title),
  ]);

  const missing = books.filter(b => b.author === '' && !registeredTitles.has(b.title));

  if (missing.length === 0) {
    console.log('著者名が空の未登録書籍はありません。');
    return;
  }

  console.log(`著者名が未設定の書籍: ${missing.length} 件`);
  console.log('');
  missing.forEach((b, i) => {
    console.log(`${i + 1}. ${b.title}`);
  });
}

/**
 * Detect pages and ISBN embedded in a title string.
 * Used only by --generate mode to pre-populate correction entries.
 *
 * Background: when Google Drive appends a " (1)" deduplication suffix, the
 * normal parseFilename path cannot extract pages/ISBN from the suffix, so they
 * end up embedded in the title field of books.json (e.g., "雪国 208p_4101001014").
 * This function strips those fields so the generated correction entry gets a
 * clean title, and the pages/isbn keys are set explicitly.
 *
 * Matches patterns like " 208p_4101001014" or " 320p_" at the end of the title.
 * Returns { cleanedTitle, pages, isbn } on match, or null if not found.
 */
function extractPagesIsbnFromTitle(title) {
  const match = title.match(/\s(\d+)p_([A-Za-z0-9]{13}|[A-Za-z0-9]{10})?$/);
  if (!match) return null;
  return {
    cleanedTitle: title.slice(0, match.index).trim(),
    pages: parseInt(match[1], 10),
    isbn: match[2] || null,
  };
}

function generateCorrections() {
  const books = loadBooks();
  const existing = loadCorrections();
  const existingTitles = new Set(existing.map(c => c.original_title));

  const newEntries = books
    .filter(b => b.author === '' && !existingTitles.has(b.title))
    .map(b => {
      const pagesIsbn = extractPagesIsbnFromTitle(b.title);
      const entry = {
        original_title: b.title,
        title: pagesIsbn ? pagesIsbn.cleanedTitle : b.title,
        author: '',
      };
      if (pagesIsbn) {
        entry.pages = pagesIsbn.pages;
        entry.isbn = pagesIsbn.isbn;
      }
      return entry;
    });

  if (newEntries.length === 0) {
    console.log('追加すべきエントリはありません。');
    return;
  }

  const merged = { corrections: [...existing, ...newEntries] };
  fs.writeFileSync(CORRECTIONS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`data/book-corrections.json に ${newEntries.length} 件のエントリを追加しました。`);
  console.log('著者名を調査して author フィールドを記入してください。');
}

const args = process.argv.slice(2);
if (args.includes('--generate')) {
  generateCorrections();
} else {
  listMissing();
}
