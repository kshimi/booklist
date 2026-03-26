'use strict';

const fs = require('fs');
const path = require('path');

const BOOKS_PATH = path.join(__dirname, '..', 'data', 'books.json');
const METADATA_PATH = path.join(__dirname, '..', 'data', 'book-metadata.json');
const AI_COMMENTS_PATH = path.join(__dirname, '..', 'data', 'book-ai-comments.json');

const EPOCH = new Date('2000-01-01');
const TODAY = new Date().toISOString().slice(0, 10);
const MODEL_NAME = 'gemini-2.5-flash-lite';

// ---------------------------------------------------------------------------
// CLI options
// ---------------------------------------------------------------------------

const ALL = process.argv.includes('--all');
const daysArg = process.argv.find(a => a.startsWith('--days=') || a === '--days');
let DAYS = null;
if (daysArg) {
  if (daysArg === '--days') {
    const next = process.argv[process.argv.indexOf('--days') + 1];
    DAYS = next ? parseInt(next, 10) : null;
  } else {
    DAYS = parseInt(daysArg.split('=')[1], 10);
  }
  if (isNaN(DAYS) || DAYS <= 0) {
    console.error('--days requires a positive integer (e.g. --days 30)');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Book selection logic (must match useDailySuggestion.js)
// ---------------------------------------------------------------------------

function bookIndexForDate(date, totalBooks) {
  const days = Math.floor((date - EPOCH) / 86400000);
  return days % totalBooks;
}

function targetIdsForDays(books, n) {
  const today = new Date();
  const ids = new Set();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    ids.add(books[bookIndexForDate(d, books.length)].id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(book, metadata) {
  const meta = metadata[book.isbn] || metadata[book.id] || null;
  const description = meta?.description;

  let prompt =
    '以下の本について、読者の興味を引く推薦コメントを日本語で400字程度で書いてください。\n' +
    '本の内容や特徴を簡潔に伝え、どんな人に向いているかも含めてください。\n\n' +
    `タイトル: ${book.title}\n` +
    `著者: ${book.author || '不明'}\n` +
    `ジャンル: ${book.genre}`;
  if (description) {
    prompt += `\nあらすじ: ${description}`;
  }
  prompt += '\n\n推薦コメントのみを出力してください（前置きや説明は不要です）。';
  return prompt;
}

// ---------------------------------------------------------------------------
// Gemini API
// ---------------------------------------------------------------------------

async function generateComment(genAI, book, metadata) {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const prompt = buildPrompt(book, metadata);
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

function loadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveComments(comments) {
  fs.writeFileSync(AI_COMMENTS_PATH, JSON.stringify(comments, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY is not set.');
    console.error('Set the environment variable and try again:');
    console.error('  export GEMINI_API_KEY=your_key_here');
    process.exit(1);
  }

  if (!fs.existsSync(BOOKS_PATH)) {
    console.error(`Error: ${BOOKS_PATH} not found. Run "node scripts/process.js" first.`);
    process.exit(1);
  }

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);

  const books = loadJson(BOOKS_PATH, []);
  const metadata = loadJson(METADATA_PATH, {});
  const comments = loadJson(AI_COMMENTS_PATH, {});

  // Determine target books
  let targets;
  if (ALL) {
    targets = books;
  } else if (DAYS !== null) {
    const ids = targetIdsForDays(books, DAYS);
    targets = books.filter(b => ids.has(b.id) && !comments[b.id]);
  } else {
    // Default: diff mode — only books without a comment
    targets = books.filter(b => !comments[b.id]);
  }

  if (targets.length === 0) {
    console.log('全対象書籍のコメントは生成済みです。');
    return;
  }

  console.log(`処理開始: 対象書籍 ${targets.length}件`);
  let saved = 0;

  for (let i = 0; i < targets.length; i++) {
    const book = targets[i];
    const label = `[${i + 1}/${targets.length}] 「${book.title}」（${book.author || '著者不明'}）`;
    process.stdout.write(`${label}... `);

    try {
      const comment = await generateComment(genAI, book, metadata);
      comments[book.id] = { comment, generatedAt: TODAY, model: MODEL_NAME };
      saveComments(comments);
      saved++;
      console.log('完了');
    } catch (err) {
      const msg = err.message || String(err);
      if (/429|quota|exhausted/i.test(msg)) {
        console.log('429 quota exceeded — 中断');
        break;
      }
      console.log(`エラー: ${msg}`);
    }
  }

  console.log(`保存済み: ${saved}件 → ${AI_COMMENTS_PATH}`);
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

module.exports = { bookIndexForDate, targetIdsForDays, buildPrompt };

// ---------------------------------------------------------------------------
// Entry point (only when run directly)
// ---------------------------------------------------------------------------

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
