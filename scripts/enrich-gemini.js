'use strict';

const fs = require('fs');
const path = require('path');

const BOOKS_PATH = path.join(__dirname, '..', 'data', 'books.json');
const ENRICHMENT_PATH = path.join(__dirname, '..', 'data', 'book-gemini-enrichment.json');

const TODAY = new Date().toISOString().slice(0, 10);
const MODEL_NAME = 'gemini-2.5-flash';

// ---------------------------------------------------------------------------
// CLI options
// ---------------------------------------------------------------------------

const ALL = process.argv.includes('--all');

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(book) {
  let prompt =
    '以下の書籍の著者名とページ数を調べてください。\n\n' +
    `タイトル: ${book.title}\n`;
  if (book.asin) {
    prompt += `ASIN: ${book.asin}\n`;
  } else if (book.isbn) {
    prompt += `ISBN: ${book.isbn}\n`;
  }
  prompt +=
    '\nこの書籍の著者名とページ数を確実に知っている場合のみ回答してください。\n' +
    '情報が不確か・類似タイトルしか見当たらない・複数候補がある場合は、必ずnullを返してください。\n' +
    '推測や類似書籍の情報を使用しないでください。\n\n' +
    '以下のJSON形式で回答してください:\n' +
    '{"author": "著者名（日本語表記）", "pages": ページ数の数値}\n\n' +
    'JSONのみを出力してください（前置きや説明は不要です）。';
  return prompt;
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseResponse(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    const author = typeof obj.author === 'string' && obj.author.trim() ? obj.author.trim() : null;
    const pages = Number.isInteger(obj.pages) && obj.pages > 0 ? obj.pages : null;
    return { author, pages };
  } catch {
    return null;
  }
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

function saveEnrichment(enrichment) {
  fs.writeFileSync(ENRICHMENT_PATH, JSON.stringify(enrichment, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY is not set.');
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
  const enrichment = loadJson(ENRICHMENT_PATH, {});

  const needsEnrichment = b => !b.author || b.pages === null;
  const targets = ALL
    ? books.filter(needsEnrichment)
    : books.filter(b => needsEnrichment(b) && !enrichment[b.id]);

  if (targets.length === 0) {
    console.log('全対象書籍の書誌情報は充足済みです。');
    return;
  }

  console.log(`処理開始: 対象書籍 ${targets.length}件`);
  let saved = 0;

  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  for (let i = 0; i < targets.length; i++) {
    const book = targets[i];
    const label = `[${i + 1}/${targets.length}] 「${book.title}」`;
    process.stdout.write(`${label}... `);

    try {
      const prompt = buildPrompt(book);
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const parsed = parseResponse(text);

      if (!parsed) {
        console.log('JSONパース失敗 — スキップ');
        continue;
      }

      enrichment[book.id] = { ...parsed, enrichedAt: TODAY, model: MODEL_NAME };
      saveEnrichment(enrichment);
      saved++;
      console.log(`完了 (author: ${parsed.author ?? 'null'}, pages: ${parsed.pages ?? 'null'})`);
    } catch (err) {
      const msg = err.message || String(err);
      if (/429|quota|exhausted/i.test(msg)) {
        console.log('429 quota exceeded — 中断');
        break;
      }
      console.log(`エラー: ${msg}`);
    }

    if (i < targets.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`保存済み: ${saved}件 → ${ENRICHMENT_PATH}`);
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

module.exports = { buildPrompt, parseResponse };

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
