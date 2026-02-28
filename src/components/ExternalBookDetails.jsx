export default function ExternalBookDetails({ data }) {
  const SOURCE_LABELS = {
    openbd: 'OpenBD',
    google_books: 'Google Books',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        {data.coverUrl && (
          <img
            src={data.coverUrl}
            alt="表紙"
            className="w-20 h-auto rounded shadow-sm flex-shrink-0"
          />
        )}
        <dl className="space-y-1.5 text-sm flex-1 min-w-0">
          {data.publisher && (
            <div>
              <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">出版社</dt>
              <dd className="text-gray-700">{data.publisher}</dd>
            </div>
          )}
          {data.publishedYear && (
            <div>
              <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">出版年</dt>
              <dd className="text-gray-700">{data.publishedYear}年</dd>
            </div>
          )}
        </dl>
      </div>

      {data.description && (
        <div>
          <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">内容紹介</dt>
          <dd className="text-sm text-gray-700 leading-relaxed line-clamp-5">{data.description}</dd>
        </div>
      )}

      <p className="text-xs text-gray-400 text-right">
        情報提供: {SOURCE_LABELS[data.source] ?? data.source}
      </p>
    </div>
  );
}
