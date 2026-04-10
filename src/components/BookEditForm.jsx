import { useState } from 'react';

const GENRES = [
  'SF',
  'エッセイ',
  'コンピュータ',
  'ノンフィクション',
  'フィクション',
  'フィクション（日本）',
  '実用',
  '家庭',
  '未分類',
  '漫画・コミック',
  '運転',
];

export default function BookEditForm({ book, onSaved }) {
  const [author, setAuthor] = useState(book.author ?? '');
  const [genre, setGenre] = useState(book.genre ?? '');
  const [subgenre, setSubgenre] = useState(book.subgenre ?? '');
  const [pages, setPages] = useState(book.pages != null ? String(book.pages) : '');
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();

    const pagesNum = pages !== '' ? parseInt(pages, 10) : null;
    if (pages !== '' && (isNaN(pagesNum) || pagesNum <= 0)) {
      setErrorMsg('ページ数は正の整数で入力してください');
      return;
    }

    setStatus('saving');
    setErrorMsg('');

    try {
      const res = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: book.id,
          author: author.trim(),
          genre: genre.trim(),
          subgenre: subgenre.trim(),
          pages: pagesNum,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('saved');
      if (onSaved) onSaved();
    } catch (err) {
      setStatus('error');
      setErrorMsg('保存に失敗しました。開発環境で実行してください。');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      <div>
        <label className="block text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
          著者名
        </label>
        <input
          type="text"
          value={author}
          onChange={e => setAuthor(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="著者名を入力"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
          ジャンル
        </label>
        <select
          value={genre}
          onChange={e => setGenre(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">選択してください</option>
          {GENRES.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
          サブジャンル
        </label>
        <input
          type="text"
          value={subgenre}
          onChange={e => setSubgenre(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="サブジャンルを入力（任意）"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
          ページ数
        </label>
        <input
          type="number"
          value={pages}
          onChange={e => setPages(e.target.value)}
          min="1"
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="ページ数を入力（任意）"
        />
      </div>

      {errorMsg && (
        <p className="text-red-500 text-xs">{errorMsg}</p>
      )}

      {status === 'saved' && (
        <p className="text-green-600 text-xs">
          保存しました。<code className="bg-gray-100 px-1 rounded">npm run process</code> を実行して反映してください。
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'saving'}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium py-1.5 rounded transition-colors"
      >
        {status === 'saving' ? '保存中...' : '保存'}
      </button>
    </form>
  );
}
