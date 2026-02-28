export const PAGE_SIZE = 50;

export const SORT_OPTIONS = [
  { key: 'title',  order: 'asc',  label: '書名（五十音順）' },
  { key: 'author', order: 'asc',  label: '著者名（五十音順）' },
  { key: 'pages',  order: 'asc',  label: 'ページ数（少ない順）' },
  { key: 'pages',  order: 'desc', label: 'ページ数（多い順）' },
];

export const GENRES = [
  'SF',
  'フィクション（日本）',
  'エッセイ',
  'ノンフィクション',
  'コンピュータ',
  '運転',
  '実用',
  '家庭',
  '漫画・コミック',
  'フィクション',
  '未分類',
];

export const VERSION_LABELS = {
  original: 'オリジナル版',
  kindle: 'Kindle版',
  ipad3: 'iPad版',
};
