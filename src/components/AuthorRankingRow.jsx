/**
 * AuthorRankingRow — single row in the author ranking table
 * Props: rank, author, bookCount, mainGenre, onSelect
 */
export default function AuthorRankingRow({ rank, author, bookCount, mainGenre, onSelect }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-2 px-3 text-sm text-gray-500 w-10 text-right">{rank}</td>
      <td className="py-2 px-3">
        <button
          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
          onClick={() => onSelect(author)}
        >
          {author}
        </button>
      </td>
      <td className="py-2 px-3 text-sm text-gray-700 text-right w-16">{bookCount}冊</td>
      <td className="py-2 px-3 text-sm text-gray-500">{mainGenre}</td>
    </tr>
  );
}
