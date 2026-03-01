'use strict';

const fs = require('fs');
const path = require('path');

const EXCLUDED_NAMES = ['self_check', '20120330_1246_33_0706', 'to_1733_912_003_5_at'];

const AUTHOR_ALIASES_PATH = path.join(__dirname, '..', 'data', 'author-aliases.json');

const GENRE_RULES = [
  { test: (p) => p.includes('エッセイ'), genre: 'エッセイ' },
  { test: (p) => p.includes('日本の作家'), genre: 'フィクション（日本）' },
  { test: (p) => / SF/.test(p) || /\/SF/.test(p), genre: 'SF' },
  { test: (p) => p.includes('ノンフィクション'), genre: 'ノンフィクション' },
  { test: (p) => p.includes('フィクション'), genre: 'フィクション' },
  { test: (p) => p.includes('実用'), genre: '実用' },
  { test: (p) => p.includes('家庭'), genre: '家庭' },
  { test: (p) => p.includes('漫画') || p.includes('コミック'), genre: '漫画・コミック' },
  { test: (p) => p.includes('コンピュータ') || p.includes("O'Reilly"), genre: 'コンピュータ' },
  { test: (p) => p.includes('運転関係'), genre: '運転' },
];

const GENRE_PRIORITY = {
  'SF': 10,
  'フィクション（日本）': 9,
  'エッセイ': 8,
  'ノンフィクション': 7,
  'コンピュータ': 7,
  '運転': 7,
  '実用': 6,
  '家庭': 6,
  '漫画・コミック': 5,
  'フィクション': 4,
  '未分類': 0,
};

// Fallback genre rules for books unclassified by folder path.
// Applied to title + author + series text when folder-based inference returns 未分類.
const GENRE_FALLBACK_RULES = [
  {
    test: (t) => /人工知能|アルゴリズム|プログラム|コンピュータ|Mathematics|Knuth/.test(t),
    genre: 'コンピュータ',
  },
  {
    test: (t) => /物理|量子|相対性|宇宙|進化|生物|化学|科学|数学|幾何|統計/.test(t),
    genre: 'ノンフィクション',
  },
  {
    test: (t) => /哲学|思想|倫理|道徳|心理|精神分析|論理|形而上/.test(t),
    genre: 'ノンフィクション',
  },
  {
    test: (t) => /自伝|自叙伝|伝記|生涯|回顧録|回想録/.test(t),
    genre: 'ノンフィクション',
  },
  {
    test: (t) => /経済|政治|社会|資本|投資|法律|宗教|仏教|神学/.test(t),
    genre: 'ノンフィクション',
  },
  {
    test: (t) => /神話|伝説|民話|民俗|説話/.test(t),
    genre: 'ノンフィクション',
  },
  {
    test: (t) => /日記|手紙|書簡|巡礼|散歩|紀行|旅日記/.test(t),
    genre: 'エッセイ',
  },
  {
    test: (t) => /童謡|詩集|俳句|和歌|百人一首|古事記|源氏物語|万葉/.test(t),
    genre: 'フィクション（日本）',
  },
];

// Subgenre rules applied after genre assignment.
// Each rule targets a specific genre and infers a subgenre from title + author + series.
const SUBGENRE_RULES = {
  'フィクション': [
    { test: (t) => /ミステリ|探偵|殺人|推理|犯罪/.test(t), subgenre: 'ミステリー' },
    { test: () => true, subgenre: 'その他フィクション' },
  ],
  'フィクション（日本）': [
    { test: (t) => /ミステリ|探偵|殺人|推理|犯罪/.test(t), subgenre: 'ミステリー' },
    { test: (t) => /時代|幕末|江戸|侍|武士|戦国|忍者|剣客/.test(t), subgenre: '歴史・時代' },
    { test: () => true, subgenre: 'その他フィクション' },
  ],
  'ノンフィクション': [
    { test: (t) => /物理|量子|相対性|宇宙|進化|生物|化学|科学|数学|幾何|統計/.test(t), subgenre: '科学・技術' },
    { test: (t) => /哲学|思想|倫理|道徳|心理|精神分析|論理|形而上/.test(t), subgenre: '哲学・思想' },
    { test: (t) => /歴史|自伝|自叙伝|伝記|生涯|回顧録|回想録|評伝/.test(t), subgenre: '歴史・伝記' },
    { test: (t) => /経済|政治|社会|資本|投資|法律/.test(t), subgenre: '社会・経済' },
    { test: () => true, subgenre: 'その他ノンフィクション' },
  ],
};

/**
 * Parse CSV text into an array of row objects.
 * Handles quoted fields containing commas and newlines.
 */
function parseCSV(text) {
  const records = [];
  let pos = 0;
  const len = text.length;

  function parseField() {
    if (pos >= len) return '';
    if (text[pos] === '"') {
      pos++; // skip opening quote
      let value = '';
      while (pos < len) {
        if (text[pos] === '"') {
          if (pos + 1 < len && text[pos + 1] === '"') {
            value += '"';
            pos += 2;
          } else {
            pos++; // skip closing quote
            break;
          }
        } else {
          value += text[pos++];
        }
      }
      return value;
    } else {
      let value = '';
      while (pos < len && text[pos] !== ',' && text[pos] !== '\n' && text[pos] !== '\r') {
        value += text[pos++];
      }
      return value;
    }
  }

  function parseRecord() {
    const fields = [];
    while (pos < len) {
      fields.push(parseField());
      if (pos < len && text[pos] === ',') {
        pos++;
      } else {
        if (pos < len && text[pos] === '\r') pos++;
        if (pos < len && text[pos] === '\n') pos++;
        break;
      }
    }
    return fields;
  }

  const headerFields = parseRecord();
  const headers = headerFields.map(h => h.trim());

  while (pos < len) {
    if (text[pos] === '\r' || text[pos] === '\n') {
      pos++;
      continue;
    }
    const fields = parseRecord();
    if (fields.length === 0 || (fields.length === 1 && fields[0] === '')) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (fields[idx] || '').trim();
    });
    records.push(row);
  }

  return records;
}

/**
 * Filter CSV rows to PDF files only, excluding management files.
 */
function filterRecords(rows) {
  return rows.filter(row => {
    const mimeType = row['MIME タイプ'] || '';
    const filename = row['ファイル名'] || '';
    if (mimeType !== 'application/pdf') return false;
    if (EXCLUDED_NAMES.some(name => filename.includes(name))) return false;
    return true;
  });
}

/**
 * Parse a PDF filename into book metadata fields.
 * Extracts: title, author, isbn, pages, series, version
 */
function parseFilename(filename) {
  let work = filename;

  // Step 1: Version detection and prefix removal
  let version = 'original';
  if (/^kindlep(w)?_/.test(work)) {
    version = 'kindle';
    work = work.replace(/^kindlep(w)?_/, '');
  } else if (work.startsWith('ipad3_')) {
    version = 'ipad3';
    work = work.slice('ipad3_'.length);
  }

  // Step 2: Remove .pdf extension
  if (work.endsWith('.pdf')) {
    work = work.slice(0, -4);
  }

  // Step 3: Extract ISBN (underscore + 10-13 alphanumeric chars at end)
  let isbn = null;
  const isbnMatch = work.match(/_([A-Za-z0-9]{10,13})$/);
  if (isbnMatch) {
    isbn = isbnMatch[1];
    work = work.slice(0, -isbnMatch[0].length);
  }

  // Step 4: Extract page count (space + digits + p at end)
  let pages = null;
  const pagesMatch = work.match(/ (\d+)p$/);
  if (pagesMatch) {
    pages = parseInt(pagesMatch[1], 10);
    work = work.slice(0, -pagesMatch[0].length);
  }

  // Step 5 & 6: Find author as text after the last closing bracket
  const lastClose = Math.max(work.lastIndexOf('）'), work.lastIndexOf(')'));
  let author = '';
  let titlePart = work;

  if (lastClose >= 0) {
    author = work.slice(lastClose + 1).trim();
    titlePart = work.slice(0, lastClose + 1);
  }

  // Extract series names from all bracket groups in titlePart
  const seriesMatches = [];
  const seriesRegex = /[（(]([^）)]+)[）)]/g;
  let seriesMatch;
  while ((seriesMatch = seriesRegex.exec(titlePart)) !== null) {
    const s = seriesMatch[1].trim();
    if (s) seriesMatches.push(s);
  }
  const series = seriesMatches.length > 0 ? seriesMatches.join('／') : null;

  // Step 7: Title is the titlePart with bracket groups and orphaned brackets removed
  const title = titlePart
    .replace(/[（(][^）)]+[）)]/g, '')
    .replace(/[）)（(]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { title, author, isbn, pages, series, version };
}

/**
 * Apply normalization rules to an author name.
 * 1. Full-width period (．) → half-width period (.) for initials.
 * 2. Single space → nakaguro (・) for two-word 姓名 format.
 */
function normalizeAuthor(author) {
  let result = author.replace(/．/g, '.');
  const spaceCount = (result.match(/ /g) || []).length;
  if (spaceCount === 1) {
    // Japanese names (containing kanji): remove the space (山田 太郎 → 山田太郎)
    // Foreign names (katakana/Latin only): replace with nakaguro (アイザック アシモフ → アイザック・アシモフ)
    const hasKanji = /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(result);
    result = hasKanji ? result.replace(' ', '') : result.replace(' ', '・');
  }
  return result.trim();
}

/**
 * Look up an author name in the alias table and return the canonical name.
 * Returns the original name unchanged if no alias is found.
 */
function resolveAuthorAlias(author, aliases) {
  return aliases[author] ?? author;
}

/**
 * Estimate genre from folder path using priority-ordered keyword matching.
 * Falls back to title/author/series keyword matching when folder path yields 未分類.
 */
function estimateGenre(folderPath, title = '', author = '', series = '') {
  for (const rule of GENRE_RULES) {
    if (rule.test(folderPath)) return rule.genre;
  }
  const text = title + ' ' + author + ' ' + (series || '');
  for (const rule of GENRE_FALLBACK_RULES) {
    if (rule.test(text)) return rule.genre;
  }
  return '未分類';
}

/**
 * Estimate subgenre from title, author, series based on the assigned genre.
 * Returns null for genres that have no subgenre rules defined.
 */
function estimateSubgenre(genre, title, author, series) {
  const rules = SUBGENRE_RULES[genre];
  if (!rules) return null;
  const text = title + ' ' + author + ' ' + (series || '');
  for (const rule of rules) {
    if (rule.test(text)) return rule.subgenre;
  }
  return null;
}

/**
 * Deduplicate file records into unique book entries.
 * Groups by ISBN (if present) or title; prefers original version values.
 */
function deduplicateBooks(files) {
  const groups = new Map();

  for (const file of files) {
    const key = file.isbn !== null ? file.isbn : file.title;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(file);
  }

  const books = [];
  for (const [, group] of groups) {
    const original = group.find(f => f.version === 'original') || group[0];

    const bestGenre = group.reduce((best, f) => {
      const p = GENRE_PRIORITY[f.genre] ?? 0;
      const bestP = GENRE_PRIORITY[best] ?? 0;
      return p > bestP ? f.genre : best;
    }, group[0].genre);

    const isbn = group.find(f => f.isbn !== null)?.isbn ?? null;
    const pages = group.find(f => f.pages !== null)?.pages ?? null;

    const subgenre = estimateSubgenre(bestGenre, original.title, original.author, original.series);

    const version_files = {};
    for (const f of group) {
      version_files[f.version] = { file_url: f.file_url, file_id: f.file_id };
    }

    books.push({
      title: original.title,
      author: original.author,
      genre: bestGenre,
      subgenre,
      series: original.series,
      isbn,
      pages,
      versions: group.map(f => f.version),
      version_files,
    });
  }

  return books;
}

/**
 * Generate a stable unique ID for a book.
 * Uses ISBN if available; otherwise a djb2 hash of the title.
 */
function generateId(book) {
  if (book.isbn) return book.isbn;
  let hash = 5381;
  for (let i = 0; i < book.title.length; i++) {
    hash = (((hash << 5) + hash) + book.title.charCodeAt(i)) >>> 0;
  }
  return 'title_' + hash.toString(16).padStart(8, '0');
}

function main() {
  const csvPath = path.join(__dirname, '..', 'data', 'booklist.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`Error: ${csvPath} not found`);
    process.exit(1);
  }

  const authorAliases = fs.existsSync(AUTHOR_ALIASES_PATH)
    ? JSON.parse(fs.readFileSync(AUTHOR_ALIASES_PATH, 'utf-8'))
    : {};

  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csvText);

  const filtered = filterRecords(rows);
  const nonPdfCount = rows.filter(r => r['MIME タイプ'] !== 'application/pdf').length;
  const managementCount = rows.length - filtered.length - nonPdfCount;

  const files = filtered.map(row => {
    const parsed = parseFilename(row['ファイル名'] || '');
    const author = resolveAuthorAlias(normalizeAuthor(parsed.author), authorAliases);
    const genre = estimateGenre(row['フォルダパス'] || '', parsed.title, author, parsed.series);
    return {
      ...parsed,
      author,
      genre,
      folder_path: row['フォルダパス'] || '',
      file_url: row['ファイルURL'] || '',
      file_id: row['ファイルID'] || '',
      file_size_mb: parseFloat(row['ファイルサイズ (MB)'] || '0'),
    };
  });

  const books = deduplicateBooks(files);

  books.sort((a, b) => a.title.localeCompare(b.title, 'ja'));

  const output = books.map(book => ({
    id: generateId(book),
    title: book.title,
    author: book.author,
    genre: book.genre,
    subgenre: book.subgenre,
    series: book.series,
    isbn: book.isbn,
    pages: book.pages,
    versions: book.versions,
    version_files: book.version_files,
  }));

  const outPath = path.join(__dirname, '..', 'data', 'books.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log('処理完了');
  console.log(`  入力レコード数: ${rows.length}`);
  console.log(`  除外レコード数: ${rows.length - filtered.length} (非PDF: ${nonPdfCount}, 管理用ファイル: ${managementCount})`);
  console.log(`  パース済みファイル数: ${filtered.length}`);
  console.log(`  統合後書籍数: ${output.length}`);
  console.log(`  出力ファイル: data/books.json`);
}

module.exports = { parseCSV, filterRecords, parseFilename, normalizeAuthor, resolveAuthorAlias, estimateGenre, estimateSubgenre, deduplicateBooks, generateId };

if (require.main === module) {
  main();
}
