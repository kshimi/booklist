'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { bookIndexForDate, targetIdsForDays, buildPrompt } = require('./generate-ai-comments.js');

const EPOCH = new Date('2000-01-01');

// Minimal book fixtures
const BOOKS = Array.from({ length: 10 }, (_, i) => ({
  id: `book-${i}`,
  title: `タイトル${i}`,
  author: `著者${i}`,
  genre: 'フィクション',
  isbn: null,
}));

// ---------------------------------------------------------------------------
// T-1 / T-2: Daily book selection logic
// ---------------------------------------------------------------------------

describe('bookIndexForDate', () => {
  test('T-1: returns a value within [0, totalBooks)', () => {
    const today = new Date();
    const idx = bookIndexForDate(today, BOOKS.length);
    assert.ok(idx >= 0 && idx < BOOKS.length, `index ${idx} out of range`);
  });

  test('T-2: same date always returns same index', () => {
    const date = new Date('2026-03-26');
    const idx1 = bookIndexForDate(date, BOOKS.length);
    const idx2 = bookIndexForDate(date, BOOKS.length);
    assert.equal(idx1, idx2);
  });

  test('T-2b: different dates return different indices for books.length > 1', () => {
    const d1 = new Date('2026-03-26');
    const d2 = new Date('2026-03-27');
    const idx1 = bookIndexForDate(d1, BOOKS.length);
    const idx2 = bookIndexForDate(d2, BOOKS.length);
    assert.notEqual(idx1, idx2);
  });

  test('T-2c: deterministic formula: days since epoch mod totalBooks', () => {
    const date = new Date('2026-01-01');
    const days = Math.floor((date - EPOCH) / 86400000);
    const expected = days % BOOKS.length;
    assert.equal(bookIndexForDate(date, BOOKS.length), expected);
  });
});

// ---------------------------------------------------------------------------
// T-8: --days option book selection
// ---------------------------------------------------------------------------

describe('targetIdsForDays', () => {
  test('T-8: returns unique book IDs for N consecutive days', () => {
    const ids = targetIdsForDays(BOOKS, 3);
    assert.ok(ids instanceof Set);
    // At most 3 unique books (may be fewer if dates map to same book mod 10)
    assert.ok(ids.size >= 1 && ids.size <= 3);
    for (const id of ids) {
      assert.ok(BOOKS.some(b => b.id === id), `${id} not found in books`);
    }
  });

  test('T-8b: N=1 returns exactly 1 book (today)', () => {
    const ids = targetIdsForDays(BOOKS, 1);
    assert.equal(ids.size, 1);
  });
});

// ---------------------------------------------------------------------------
// buildPrompt
// ---------------------------------------------------------------------------

describe('buildPrompt', () => {
  test('includes title, author, genre', () => {
    const book = { id: 'b1', title: 'テスト書', author: '著者A', genre: 'SF', isbn: null };
    const prompt = buildPrompt(book, {});
    assert.ok(prompt.includes('テスト書'));
    assert.ok(prompt.includes('著者A'));
    assert.ok(prompt.includes('SF'));
  });

  test('omits あらすじ line when description is unavailable', () => {
    const book = { id: 'b1', title: 'テスト書', author: '著者A', genre: 'SF', isbn: null };
    const prompt = buildPrompt(book, {});
    assert.ok(!prompt.includes('あらすじ'));
  });

  test('includes あらすじ when description is available via isbn key', () => {
    const book = { id: 'b1', title: 'テスト書', author: '著者A', genre: 'SF', isbn: '1234567890' };
    const metadata = { '1234567890': { description: 'あらすじテキスト' } };
    const prompt = buildPrompt(book, metadata);
    assert.ok(prompt.includes('あらすじ'));
    assert.ok(prompt.includes('あらすじテキスト'));
  });

  test('includes あらすじ when description is available via id key', () => {
    const book = { id: 'b1', title: 'テスト書', author: '著者A', genre: 'SF', isbn: null };
    const metadata = { 'b1': { description: 'あらすじテキスト2' } };
    const prompt = buildPrompt(book, metadata);
    assert.ok(prompt.includes('あらすじテキスト2'));
  });
});
