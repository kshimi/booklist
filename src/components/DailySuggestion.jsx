import { getDailySuggestion } from '../utils/getDailySuggestion';

function todayLabel() {
  return new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
}

export default function DailySuggestion({ books, bookMetadata, aiComments, onSelectBook }) {
  const { book, comment, fallbackText } = getDailySuggestion(books, bookMetadata, aiComments);

  if (!book) return null;

  const meta = bookMetadata?.[book.isbn] ?? bookMetadata?.[book.id] ?? null;
  const coverUrl = meta?.coverUrl ?? null;
  const displayText = comment ?? fallbackText;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <p className="text-xs font-medium text-amber-600 mb-3">
        今日のおすすめ（{todayLabel()}）
      </p>
      <div
        className="flex gap-4 cursor-pointer group"
        onClick={() => onSelectBook(book)}
      >
        {coverUrl && (
          <img
            src={coverUrl}
            alt={book.title}
            className="w-16 h-24 object-cover rounded shadow-sm flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-gray-800 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
            {book.title}
          </h2>
          {book.author && (
            <p className="text-xs text-gray-500 mt-0.5">{book.author}</p>
          )}
          <span className="inline-block mt-1 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
            {book.genre}
          </span>
          {displayText && (
            <p className="text-xs text-gray-700 mt-2 leading-relaxed line-clamp-4">
              {displayText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
