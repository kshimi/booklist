import AuthorRankingRow from './AuthorRankingRow';

/**
 * AuthorRanking — top-N authors by book count
 * Props: authorStats ([{ author, bookCount, mainGenre }]), onSelectAuthor
 */
export default function AuthorRanking({ authorStats, onSelectAuthor }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-3">著者別ランキング（上位20名）</h2>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-2 px-3 text-xs font-medium text-gray-500 text-right w-10">順位</th>
              <th className="py-2 px-3 text-xs font-medium text-gray-500 text-left">著者名</th>
              <th className="py-2 px-3 text-xs font-medium text-gray-500 text-right w-16">冊数</th>
              <th className="py-2 px-3 text-xs font-medium text-gray-500 text-left">代表ジャンル</th>
            </tr>
          </thead>
          <tbody>
            {authorStats.map(({ author, bookCount, mainGenre }, index) => (
              <AuthorRankingRow
                key={author}
                rank={index + 1}
                author={author}
                bookCount={bookCount}
                mainGenre={mainGenre}
                onSelect={onSelectAuthor}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
