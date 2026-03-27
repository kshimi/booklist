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

  test('excludes ［雑誌］ titles (fullwidth brackets) with reason magazine', () => {
    const { books, excluded } = filterBooks([makeRow('BiCYCLE CLUB 2016年7月号　No.375［雑誌］')]);
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

  test('excludes movie with (字幕版) marker as video', () => {
    const { excluded } = filterBooks([makeRow('コンテイジョン (字幕版)')]);
    assert.equal(excluded[0].reason, 'video');
  });

  test('excludes movie with (吹替版) marker as video', () => {
    const { excluded } = filterBooks([makeRow('コンテイジョン (吹替版)')]);
    assert.equal(excluded[0].reason, 'video');
  });

  test('excludes STARTER BOOK titles with reason starter_book', () => {
    const { excluded } = filterBooks([makeRow('ONE PIECE STARTER BOOK 1 (ジャンプコミックスDIGITAL)')]);
    assert.equal(excluded[0].reason, 'starter_book');
  });

  test('excludes Subscription_Renewal rows with reason subscription', () => {
    const row = { 'Product Name': 'Kindle Unlimited', 'ASIN': 'B001', 'Subscription Order Type': 'Subscription_Renewal' };
    const { excluded } = filterBooks([row]);
    assert.equal(excluded[0].reason, 'subscription');
  });

  test('excludes 予告編 titles as video', () => {
    const { excluded } = filterBooks([makeRow('「ロード・オブ・ザ・リング」3部作予告編集')]);
    assert.equal(excluded[0].reason, 'video');
  });

  test('excludes single TV episode titles starting with 第n話 as video', () => {
    const { excluded } = filterBooks([makeRow('第1話 戦車道、始めます！')]);
    assert.equal(excluded[0].reason, 'video');
  });

  test('excludes リマスター版 titles as video', () => {
    const { excluded } = filterBooks([makeRow('進撃の巨人　悔いなき選択　リマスター版（１）')]);
    assert.equal(excluded[0].reason, 'video');
  });

  test('excludes リリース記念版 titles as promotional', () => {
    const { excluded } = filterBooks([makeRow('家に帰ると妻が必ず死んだふりをしています。3 【リリース記念版　特別書き下ろし4コマ】')]);
    assert.equal(excluded[0].reason, 'promotional');
  });

  test('excludes "Not Applicable" exact title as invalid', () => {
    const { excluded } = filterBooks([makeRow('Not Applicable')]);
    assert.equal(excluded[0].reason, 'invalid');
  });

  test('keeps title that merely contains "Not Applicable" substring', () => {
    const { books } = filterBooks([makeRow('This is Not Applicable to anything')]);
    assert.equal(books.length, 1);
  });

  test('excludes るるぶ travel guidebooks as travel_guide', () => {
    const { excluded } = filterBooks([makeRow('るるぶ台北\'15 (るるぶ情報版（海外）)')]);
    assert.equal(excluded[0].reason, 'travel_guide');
  });

  test('excludes 地球の歩き方 travel guidebooks as travel_guide', () => {
    const { excluded } = filterBooks([makeRow('地球の歩き方 ダイジェスト版 2014 Summer')]);
    assert.equal(excluded[0].reason, 'travel_guide');
  });

  test('excludes YouTube app as app', () => {
    const { excluded } = filterBooks([makeRow('YouTube')]);
    assert.equal(excluded[0].reason, 'app');
  });

  test('excludes NHKプラス app as app', () => {
    const { excluded } = filterBooks([makeRow('NHKプラス')]);
    assert.equal(excluded[0].reason, 'app');
  });

  test('excludes MAGon magazine platform items as magazine', () => {
    const { excluded } = filterBooks([makeRow('西田宗千佳のRandom Analysis 第021号[2013年1月9日発行] (MAGon)')]);
    assert.equal(excluded[0].reason, 'magazine');
  });

  test('excludes 新潮文庫の100冊 catalog as promotional', () => {
    const { excluded } = filterBooks([makeRow('新潮文庫の100冊 2025')]);
    assert.equal(excluded[0].reason, 'promotional');
  });

  test('excludes BRUTUS magazine as magazine', () => {
    const { excluded } = filterBooks([makeRow('BRUTUS特別編集　増補版 台湾')]);
    assert.equal(excluded[0].reason, 'magazine');
  });

  test('excludes SPEC drama series as video', () => {
    const { excluded } = filterBooks([makeRow('SPEC　I (角川文庫)')]);
    assert.equal(excluded[0].reason, 'video');
  });

  test('excludes 劇場版SPEC as video', () => {
    const { excluded } = filterBooks([makeRow('劇場版SPEC～結～爻ノ篇 (角川文庫)')]);
    assert.equal(excluded[0].reason, 'video');
  });

  test('excludes ネタばれ注意！ TV digest as video', () => {
    const { excluded } = filterBooks([makeRow('ネタばれ注意！24シーズン2 早分かりダイジェスト')]);
    assert.equal(excluded[0].reason, 'video');
  });

  test('excludes RRR as excluded', () => {
    const { excluded } = filterBooks([makeRow('RRR')]);
    assert.equal(excluded[0].reason, 'excluded');
  });

  test('excludes 突然！２０５０年 as excluded', () => {
    const { excluded } = filterBooks([makeRow('突然！２０５０年')]);
    assert.equal(excluded[0].reason, 'excluded');
  });

  test('excludes 新生グリー誕生 as excluded', () => {
    const { excluded } = filterBooks([makeRow('新生グリー誕生')]);
    assert.equal(excluded[0].reason, 'excluded');
  });

  test('excludes ＥＤＥＮ manga as excluded', () => {
    const { excluded } = filterBooks([makeRow('ＥＤＥＮ（１） (アフタヌーンコミックス)')]);
    assert.equal(excluded[0].reason, 'excluded');
  });

  test('excludes 生贄投票 as excluded', () => {
    const { excluded } = filterBooks([makeRow('生贄投票（１） (ヤングマガジンコミックス)')]);
    assert.equal(excluded[0].reason, 'excluded');
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

  // Publisher suffix stripping
  test('strips publisher suffix before applying 全角数字 volume pattern', () => {
    assert.equal(makeGroupKey('ハコヅメ～交番女子の逆襲～（１７） (モーニングコミックス)'), 'ハコヅメ～交番女子の逆襲～');
  });

  test('strips publisher suffix before applying fullwidth-space + digits pattern', () => {
    assert.equal(makeGroupKey('弱虫ペダル　16 (少年チャンピオン・コミックス)'), '弱虫ペダル');
  });

  test('strips publisher suffix before applying half-width paren volume pattern', () => {
    assert.equal(makeGroupKey('罠ガール(7) (電撃コミックスNEXT)'), '罠ガール');
  });

  test('strips publisher suffix with ASCII publisher name', () => {
    assert.equal(makeGroupKey('ダンジョン飯 9巻 (HARTA COMIX)'), 'ダンジョン飯');
  });

  test('does not strip paren content starting with a digit (volume pattern)', () => {
    // "(7)" starts with digit — should NOT be stripped by publisher strip, still matched by pattern 5
    assert.equal(makeGroupKey('罠ガール(7)'), '罠ガール');
  });

  // New volume patterns
  test('removes fullwidth space + Arabic digits (priority 6b)', () => {
    assert.equal(makeGroupKey('弱虫ペダル　16'), '弱虫ペダル');
  });

  test('removes half-width space + digits + 巻 (priority 4b)', () => {
    assert.equal(makeGroupKey('ダンジョン飯 9巻'), 'ダンジョン飯');
  });

  test('removes fullwidth space + fullwidth digits + 巻 (priority 4b)', () => {
    assert.equal(makeGroupKey('ゆるキャン△　１６巻'), 'ゆるキャン△');
  });

  // Pattern 4 fix: mixed digit width in fullwidth brackets
  test('removes fullwidth brackets with half-width digit (priority 4 fix)', () => {
    assert.equal(makeGroupKey('秘本玉くしけ（1）'), '秘本玉くしけ');
  });

  // 【特典付き】 strip
  test('strips 【特典付き】 before applying 巻 pattern', () => {
    assert.equal(makeGroupKey('ゆるキャン△　１０巻【特典付き】 (まんがタイムＫＲコミックス)'), 'ゆるキャン△');
  });

  // Volume bracket mid-title + trailing text strip
  test('strips text after volume bracket in middle of title (チェーザレ pattern)', () => {
    assert.equal(makeGroupKey('チェーザレ（１）　破壊の創造者 チェーザレ　破壊の創造者 (モーニングコミックス)'), 'チェーザレ');
  });

  test('strips 「Series」シリーズ suffix after volume bracket (太平記)', () => {
    assert.equal(makeGroupKey('太平記（一） 「太平記」シリーズ (角川文庫)'), '太平記');
  });

  test('strips series suffix after 上下 bracket (夜はやさし)', () => {
    assert.equal(makeGroupKey('夜はやさし（上） 「夜はやさし」シリーズ (角川文庫)'), '夜はやさし');
  });

  // 見仏記 pattern: fullwidth digit + fullwidth space + subtitle
  test('strips attached digit and subtitle (見仏記 pattern)', () => {
    assert.equal(makeGroupKey('見仏記２　仏友篇 (角川文庫)'), '見仏記');
  });

  test('title without volume number is unchanged (見仏記 vol.1)', () => {
    assert.equal(makeGroupKey('見仏記 (角川文庫)'), '見仏記');
  });

  // 海猿 pattern: fullwidth digits directly attached
  test('removes fullwidth digits directly attached (priority 6c)', () => {
    assert.equal(makeGroupKey('海猿１'), '海猿');
  });

  test('removes multi-digit fullwidth number directly attached', () => {
    assert.equal(makeGroupKey('海猿１２'), '海猿');
  });

  // 北斎漫画 pattern: 〈全n巻〉 + 第n巻
  test('strips 〈全n巻〉 annotation and 第n巻 suffix (北斎漫画)', () => {
    assert.equal(makeGroupKey('北斎漫画〈全５巻〉 第１巻'), '北斎漫画');
  });

  // 限界集落 pattern: 第[漢数字]巻 directly attached
  test('strips 第[漢数字]巻 directly attached (限界集落)', () => {
    assert.equal(makeGroupKey('限界集落(ギリギリ)温泉第一巻'), '限界集落(ギリギリ)温泉');
  });

  test('strips 第四巻 (漢数字)', () => {
    assert.equal(makeGroupKey('限界集落(ギリギリ)温泉第四巻'), '限界集落(ギリギリ)温泉');
  });

  // ローマ人の物語 pattern: ── prefix + Roman numeral after ]
  test('strips ── subtitle prefix and Roman numeral after ] (ローマ人の物語)', () => {
    assert.equal(makeGroupKey('ローマは一日にして成らず──ローマ人の物語［電子版］I'), 'ローマ人の物語［電子版］');
  });

  test('strips multi-char Roman numeral after ] (XIV)', () => {
    assert.equal(makeGroupKey('キリストの勝利──ローマ人の物語［電子版］XIV'), 'ローマ人の物語［電子版］');
  });

  // レンズマン pattern: ・シリーズ label used as group key
  test('uses ・シリーズ label as group key', () => {
    assert.equal(makeGroupKey('グレー・レンズマン レンズマン・シリーズ'), 'レンズマン・シリーズ');
  });

  test('same ・シリーズ key for different books in series', () => {
    assert.equal(makeGroupKey('ファースト・レンズマン レンズマン・シリーズ'), 'レンズマン・シリーズ');
  });

  // ムショ医 pattern: half-width digits directly attached
  test('removes half-width digit directly attached (ムショ医 pattern)', () => {
    assert.equal(makeGroupKey('ムショ医1'), 'ムショ医');
  });

  test('removes multi-digit half-width number directly attached', () => {
    assert.equal(makeGroupKey('ムショ医5'), 'ムショ医');
  });

  test('removes wave-dash subtitle e.g. ムショ医 ～再診～', () => {
    assert.equal(makeGroupKey('ムショ医 ～再診～'), 'ムショ医');
  });

  // ピーターラビット pattern: leading 【...】 + enclosed digit + subtitle
  test('strips leading 【対訳】 and enclosed digit + subtitle', () => {
    assert.equal(
      makeGroupKey('【対訳】ピーターラビット ①　ピーターラビットのおはなし　-THE TALE OF PETER RABBIT-'),
      'ピーターラビット'
    );
  });

  test('strips leading 【対訳】 and enclosed ② + subtitle', () => {
    assert.equal(
      makeGroupKey('【対訳】ピーターラビット ②　ベンジャミンバニーのおはなし　-THE TALE OF BENJAMIN BUNNY-'),
      'ピーターラビット'
    );
  });

  // 犬のかがやき pattern: subtitle ending with 編
  test('strips half-width space + subtitle + 編', () => {
    assert.equal(makeGroupKey('犬のかがやき かにとなかよく編'), '犬のかがやき');
  });

  test('strips fullwidth space + subtitle + 編 (long subtitle)', () => {
    assert.equal(
      makeGroupKey('犬のかがやき　実在の商品とか 固有名詞とかが出てくる ものを全部この巻に まとめているから 何かあった時は これを消すだけで 大丈夫編'),
      '犬のかがやき'
    );
  });

  test('strips fullwidth space + 日常編 after volume number strip', () => {
    // Step 6b strips 　1 first, then 編 pattern strips 　日常編
    assert.equal(makeGroupKey('犬のかがやき　日常編　1'), '犬のかがやき');
  });

  // 太平記（ニ）pattern: katakana ニ treated as volume number
  test('handles katakana ニ as volume number in brackets', () => {
    assert.equal(makeGroupKey('太平記（ニ） 「太平記」シリーズ (角川文庫)'), '太平記');
  });

  // 火星の人 pattern: 〔新版〕 annotation + half-width space + 上/下
  test('strips 〔〕 editorial annotation and half-width space + 上', () => {
    assert.equal(makeGroupKey('火星の人〔新版〕 上 (ハヤカワ文庫SF)'), '火星の人');
  });

  test('strips 〔〕 annotation and half-width space + 下', () => {
    assert.equal(makeGroupKey('火星の人〔新版〕 下 (ハヤカワ文庫SF)'), '火星の人');
  });

  // 銃・病原菌・鉄 pattern: 全角space + 上下 + 巻
  test('strips fullwidth-space + 上巻', () => {
    assert.equal(makeGroupKey('銃・病原菌・鉄　上巻'), '銃・病原菌・鉄');
  });

  test('strips fullwidth-space + 下巻', () => {
    assert.equal(makeGroupKey('銃・病原菌・鉄　下巻'), '銃・病原菌・鉄');
  });

  // 史記 pattern: half-width space + digit + space + subtitle + 上/下
  test('strips half-width space + digit + subtitle + 上 (史記 pattern)', () => {
    assert.equal(makeGroupKey('史記 1 項羽と劉邦 上'), '史記');
  });

  test('strips half-width space + digit + subtitle (multi-digit)', () => {
    assert.equal(makeGroupKey('史記 4 呉越燃ゆ 上'), '史記');
  });

  // ブス界 pattern: fullwidth-space + digit + colon + subtitle
  test('strips fullwidth-space + digit + colon + subtitle (ブス界 pattern)', () => {
    assert.equal(makeGroupKey('ブス界へようこそ　１: 闘え、私。'), 'ブス界へようこそ');
  });

  test('strips fullwidth-space + multi-digit + colon + subtitle', () => {
    assert.equal(makeGroupKey('ブス界へようこそ　10: 桔梗信玄'), 'ブス界へようこそ');
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
