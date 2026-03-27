'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseCSV,
  deduplicateByAsin,
  filterBooks,
  makeGroupKey,
  mergeVolumes,
} = require('./parse-kindle-list.js');

// ---------------------------------------------------------------------------
// deduplicateByAsin
// ---------------------------------------------------------------------------

describe('deduplicateByAsin', () => {
  function makeRow(asin, title, status = 'SUCCESS', componentType = 'Price Amount') {
    return {
      'ASIN': asin,
      'Product Name': title,
      'Order Status': status,
      'Component Type': componentType,
      'Publisher': 'テスト出版社',
    };
  }

  test('deduplicates same ASIN with multiple component types into 1 record', () => {
    const rows = [
      makeRow('B08YH9CBGM', '三体', 'SUCCESS', 'Price Amount'),
      makeRow('B08YH9CBGM', '三体', 'SUCCESS', 'Tax'),
    ];
    const result = deduplicateByAsin(rows);
    assert.equal(result.length, 1);
    assert.equal(result[0]['ASIN'], 'B08YH9CBGM');
  });

  test('excludes rows with Order Status other than SUCCESS', () => {
    const rows = [
      makeRow('B001', '本A', 'CANCELLED'),
      makeRow('B002', '本B', 'SUCCESS'),
    ];
    const result = deduplicateByAsin(rows);
    assert.equal(result.length, 1);
    assert.equal(result[0]['ASIN'], 'B002');
  });

  test('keeps distinct ASINs as separate records', () => {
    const rows = [
      makeRow('B001', '本A'),
      makeRow('B002', '本B'),
    ];
    const result = deduplicateByAsin(rows);
    assert.equal(result.length, 2);
  });

  test('returns first occurrence for duplicate ASIN', () => {
    const rows = [
      makeRow('B001', '本A first'),
      makeRow('B001', '本A second'),
    ];
    const result = deduplicateByAsin(rows);
    assert.equal(result[0]['Product Name'], '本A first');
  });

  test('returns empty array when all rows are non-SUCCESS', () => {
    const rows = [makeRow('B001', '本A', 'REFUNDED')];
    assert.deepEqual(deduplicateByAsin(rows), []);
  });
});

// ---------------------------------------------------------------------------
// filterBooks
// ---------------------------------------------------------------------------

describe('filterBooks', () => {
  function makeRow(title, asin = 'B000000001') {
    return { 'Product Name': title, 'ASIN': asin };
  }

  test('excludes [ビデオ] titles with reason video', () => {
    const { books, excluded } = filterBooks([makeRow('アニメ作品 [ビデオ]')]);
    assert.equal(books.length, 0);
    assert.equal(excluded.length, 1);
    assert.equal(excluded[0].reason, 'video');
  });

  test('excludes [Video] titles with reason video', () => {
    const { books, excluded } = filterBooks([makeRow('Some Movie [Video]')]);
    assert.equal(books.length, 0);
    assert.equal(excluded[0].reason, 'video');
  });

  test('excludes [雑誌] titles with reason magazine', () => {
    const { books, excluded } = filterBooks([makeRow('山と溪谷 2019年 2月号 [雑誌]')]);
    assert.equal(books.length, 0);
    assert.equal(excluded[0].reason, 'magazine');
  });

  test('excludes titles containing 無料 with reason free_trial', () => {
    const { books, excluded } = filterBooks([makeRow('作品名【期間限定 無料お試し版】')]);
    assert.equal(books.length, 0);
    assert.equal(excluded[0].reason, 'free_trial');
  });

  test('excludes titles containing 試し読み with reason free_trial', () => {
    const { books, excluded } = filterBooks([makeRow('作品名 無料試し読み版')]);
    assert.equal(books.length, 0);
    assert.equal(excluded[0].reason, 'free_trial');
  });

  test('excludes titles containing お試し with reason free_trial', () => {
    const { books, excluded } = filterBooks([makeRow('作品名 お試し版')]);
    assert.equal(books.length, 0);
    assert.equal(excluded[0].reason, 'free_trial');
  });

  test('keeps normal book titles', () => {
    const { books, excluded } = filterBooks([makeRow('三体')]);
    assert.equal(books.length, 1);
    assert.equal(excluded.length, 0);
  });

  test('excluded record contains asin, title, and reason', () => {
    const { excluded } = filterBooks([makeRow('アニメ作品 [ビデオ]', 'B12345')]);
    assert.equal(excluded[0].asin, 'B12345');
    assert.equal(excluded[0].title, 'アニメ作品 [ビデオ]');
    assert.equal(excluded[0].reason, 'video');
  });

  test('processes mix of books and excluded items', () => {
    const rows = [
      makeRow('三体', 'B001'),
      makeRow('アニメ [ビデオ]', 'B002'),
      makeRow('宇宙兄弟', 'B003'),
    ];
    const { books, excluded } = filterBooks(rows);
    assert.equal(books.length, 2);
    assert.equal(excluded.length, 1);
  });
});

// ---------------------------------------------------------------------------
// makeGroupKey
// ---------------------------------------------------------------------------

describe('makeGroupKey', () => {
  test('removes （上）suffix (priority 1)', () => {
    assert.equal(makeGroupKey('三体Ⅱ　黒暗森林（上）'), '三体Ⅱ　黒暗森林');
  });

  test('removes （下）suffix (priority 1)', () => {
    assert.equal(makeGroupKey('三体Ⅱ　黒暗森林（下）'), '三体Ⅱ　黒暗森林');
  });

  test('removes （中）suffix (priority 1)', () => {
    assert.equal(makeGroupKey('タイトル（中）'), 'タイトル');
  });

  test('removes trailing 全角space + 上 (priority 2)', () => {
    assert.equal(makeGroupKey('三体Ⅲ　死神永生　上'), '三体Ⅲ　死神永生');
  });

  test('removes trailing 全角space + 下 (priority 2)', () => {
    assert.equal(makeGroupKey('三体Ⅲ　死神永生　下'), '三体Ⅲ　死神永生');
  });

  test('removes 漢数字 in brackets (priority 3)', () => {
    assert.equal(makeGroupKey('太平記（三）'), '太平記');
  });

  test('removes 漢数字 （六） (priority 3)', () => {
    assert.equal(makeGroupKey('太平記（六）'), '太平記');
  });

  test('removes 全角アラビア数字 in brackets (priority 4)', () => {
    assert.equal(makeGroupKey('宇宙兄弟（２５）'), '宇宙兄弟');
  });

  test('removes 全角アラビア数字 （１） (priority 4)', () => {
    assert.equal(makeGroupKey('宇宙兄弟（１）'), '宇宙兄弟');
  });

  test('removes 半角数字 in parens (priority 5)', () => {
    assert.equal(makeGroupKey('罠ガール(7)'), '罠ガール');
  });

  test('removes trailing space + Arabic digits (priority 6)', () => {
    assert.equal(makeGroupKey('弱虫ペダル 16'), '弱虫ペダル');
  });

  test('removes Roman numeral suffix (priority 7)', () => {
    assert.equal(makeGroupKey('ローマ人の物語 XIV'), 'ローマ人の物語');
  });

  test('does not modify title with no volume suffix', () => {
    assert.equal(makeGroupKey('三体'), '三体');
  });

  test('does not strip Ⅱ from middle of title (三体Ⅱ)', () => {
    // 三体Ⅱ　黒暗森林（上）→ after stripping （上）: 三体Ⅱ　黒暗森林
    // The Ⅱ is part of the title, not a suffix
    const key = makeGroupKey('三体Ⅱ　黒暗森林（上）');
    assert.ok(key.includes('Ⅱ'), `Key should retain Ⅱ in title, got: ${key}`);
  });
});

// ---------------------------------------------------------------------------
// mergeVolumes
// ---------------------------------------------------------------------------

describe('mergeVolumes', () => {
  function makeRow(asin, title) {
    return { 'ASIN': asin, 'Product Name': title };
  }

  test('single-volume book is kept as-is', () => {
    const rows = [makeRow('B001', '三体')];
    const { merged, mergedGroups } = mergeVolumes(rows);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, '三体');
    assert.equal(merged[0].asin, 'B001');
    assert.deepEqual(merged[0].asins, ['B001']);
    assert.equal(mergedGroups.length, 0);
  });

  test('merges 上下巻 into single entry', () => {
    const rows = [
      makeRow('B001', '三体Ⅱ　黒暗森林（上）'),
      makeRow('B002', '三体Ⅱ　黒暗森林（下）'),
    ];
    const { merged, mergedGroups } = mergeVolumes(rows);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, '三体Ⅱ　黒暗森林');
    assert.equal(merged[0].asin, 'B001');
    assert.deepEqual(merged[0].asins, ['B001', 'B002']);
  });

  test('merged group is recorded in mergedGroups', () => {
    const rows = [
      makeRow('B001', '三体Ⅱ　黒暗森林（上）'),
      makeRow('B002', '三体Ⅱ　黒暗森林（下）'),
    ];
    const { mergedGroups } = mergeVolumes(rows);
    assert.equal(mergedGroups.length, 1);
    assert.equal(mergedGroups[0].title, '三体Ⅱ　黒暗森林');
    assert.equal(mergedGroups[0].asin, 'B001');
    assert.ok(mergedGroups[0].merged_titles.includes('三体Ⅱ　黒暗森林（上）'));
    assert.ok(mergedGroups[0].merged_titles.includes('三体Ⅱ　黒暗森林（下）'));
    assert.ok(mergedGroups[0].merged_asins.includes('B001'));
    assert.ok(mergedGroups[0].merged_asins.includes('B002'));
  });

  test('merges 漢数字 volumes into single entry', () => {
    const rows = [
      makeRow('B001', '太平記（一）'),
      makeRow('B002', '太平記（二）'),
      makeRow('B003', '太平記（三）'),
    ];
    const { merged } = mergeVolumes(rows);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, '太平記');
    assert.deepEqual(merged[0].asins, ['B001', 'B002', 'B003']);
  });

  test('merges 全角数字 volumes into single entry', () => {
    const rows = [
      makeRow('B001', '宇宙兄弟（１）'),
      makeRow('B002', '宇宙兄弟（２）'),
    ];
    const { merged } = mergeVolumes(rows);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, '宇宙兄弟');
  });

  test('representative ASIN is the first ASIN in the group', () => {
    const rows = [
      makeRow('B003', '宇宙兄弟（３）'),
      makeRow('B001', '宇宙兄弟（１）'),
    ];
    const { merged } = mergeVolumes(rows);
    assert.equal(merged[0].asin, 'B003');
  });

  test('non-merged books are not included in mergedGroups', () => {
    const rows = [
      makeRow('B001', '三体'),
      makeRow('B002', '銀河英雄伝説（上）'),
      makeRow('B003', '銀河英雄伝説（下）'),
    ];
    const { merged, mergedGroups } = mergeVolumes(rows);
    assert.equal(merged.length, 2);
    assert.equal(mergedGroups.length, 1);
    assert.equal(mergedGroups[0].title, '銀河英雄伝説');
  });
});
