export const AUTHOR_UNSET = '__UNSET__';

export default function AuthorFilter({ authors, selectedAuthor, onSelect }) {
  return (
    <select
      value={selectedAuthor ?? ''}
      onChange={e => onSelect(e.target.value || null)}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
    >
      <option value="">すべての著者</option>
      <option value={AUTHOR_UNSET}>著者未設定</option>
      {authors.map(author => (
        <option key={author} value={author}>
          {author}
        </option>
      ))}
    </select>
  );
}
