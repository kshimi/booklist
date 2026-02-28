export default function BookCard({ book, onSelect, onSelectAuthor }) {
  function handleAuthorClick(e) {
    e.stopPropagation();
    onSelectAuthor(book.author);
  }

  return (
    <div
      onClick={() => onSelect(book)}
      className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
    >
      <h3 className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2 mb-1">
        {book.title}
      </h3>
      {book.author && (
        <button
          onClick={handleAuthorClick}
          className="text-xs text-blue-600 hover:underline text-left"
        >
          {book.author}
        </button>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
          {book.genre}
        </span>
        {book.series && (
          <span className="inline-block bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">
            {book.series}
          </span>
        )}
      </div>
      {book.versions && book.versions.length > 0 && (
        <div className="mt-2 flex gap-1">
          {book.versions.map(v => (
            <span
              key={v}
              className="inline-block bg-green-50 text-green-700 text-xs px-1.5 py-0.5 rounded"
            >
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
