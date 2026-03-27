'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildPrompt, parseResponse } = require('./enrich-gemini.js');

// ---------------------------------------------------------------------------
// buildPrompt
// ---------------------------------------------------------------------------

describe('buildPrompt', () => {
  test('includes title', () => {
    const book = { id: 'B001', title: '三体', author: '', asin: 'B001', isbn: null, pages: null };
    const prompt = buildPrompt(book);
    assert.ok(prompt.includes('三体'));
  });

  test('includes ASIN when present', () => {
    const book = { id: 'B001', title: '三体', author: '', asin: 'B07TS9XTSD', isbn: null, pages: null };
    const prompt = buildPrompt(book);
    assert.ok(prompt.includes('ASIN: B07TS9XTSD'));
    assert.ok(!prompt.includes('ISBN:'));
  });

  test('includes ISBN when ASIN is absent', () => {
    const book = { id: '9784101', title: 'こころ', author: '', asin: null, isbn: '9784101020112', pages: null };
    const prompt = buildPrompt(book);
    assert.ok(prompt.includes('ISBN: 9784101020112'));
    assert.ok(!prompt.includes('ASIN:'));
  });

  test('omits identifier line when both ASIN and ISBN are absent', () => {
    const book = { id: 'title_abc', title: 'タイトル', author: '', asin: null, isbn: null, pages: null };
    const prompt = buildPrompt(book);
    assert.ok(!prompt.includes('ASIN:'));
    assert.ok(!prompt.includes('ISBN:'));
  });

  test('requests JSON-only output', () => {
    const book = { id: 'B001', title: '本', author: '', asin: null, isbn: null, pages: null };
    const prompt = buildPrompt(book);
    assert.ok(prompt.includes('JSONのみを出力'));
  });
});

// ---------------------------------------------------------------------------
// parseResponse — T-7: handles invalid/unexpected Gemini responses
// ---------------------------------------------------------------------------

describe('parseResponse', () => {
  test('parses valid JSON with author and pages', () => {
    const result = parseResponse('{"author": "夏目漱石", "pages": 300}');
    assert.deepEqual(result, { author: '夏目漱石', pages: 300 });
  });

  test('returns null author when author is null in JSON', () => {
    const result = parseResponse('{"author": null, "pages": 200}');
    assert.equal(result.author, null);
    assert.equal(result.pages, 200);
  });

  test('returns null pages when pages is null in JSON', () => {
    const result = parseResponse('{"author": "著者名", "pages": null}');
    assert.equal(result.author, '著者名');
    assert.equal(result.pages, null);
  });

  test('returns null pages when pages is 0 or negative', () => {
    assert.equal(parseResponse('{"author": "著者", "pages": 0}').pages, null);
    assert.equal(parseResponse('{"author": "著者", "pages": -1}').pages, null);
  });

  test('returns null author when author is empty string', () => {
    const result = parseResponse('{"author": "", "pages": 100}');
    assert.equal(result.author, null);
  });

  test('extracts JSON embedded in surrounding text', () => {
    const result = parseResponse('回答: {"author": "著者A", "pages": 150} 以上');
    assert.deepEqual(result, { author: '著者A', pages: 150 });
  });

  test('returns null when no JSON object found', () => {
    assert.equal(parseResponse('著者名は不明です'), null);
  });

  test('returns null when JSON is malformed', () => {
    assert.equal(parseResponse('{author: "著者", pages: 100}'), null);
  });

  test('trims whitespace from author', () => {
    const result = parseResponse('{"author": "  著者B  ", "pages": 200}');
    assert.equal(result.author, '著者B');
  });
});
