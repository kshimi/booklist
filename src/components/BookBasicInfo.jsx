export default function BookBasicInfo({ book, onSelectAuthor }) {
  function handleAuthorClick(e) {
    e.preventDefault();
    onSelectAuthor(book.author);
  }

  return (
    <dl className="space-y-2 text-sm">
      <div>
        <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">タイトル</dt>
        <dd className="text-gray-800 font-semibold leading-snug">{book.title}</dd>
      </div>

      {book.author && (
        <div>
          <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">著者</dt>
          <dd>
            <button
              onClick={handleAuthorClick}
              className="text-blue-600 hover:underline text-left"
            >
              {book.author}
            </button>
          </dd>
        </div>
      )}

      <div>
        <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">ジャンル</dt>
        <dd className="text-gray-700">
          {book.genre}
          {book.subgenre && <span className="text-gray-400"> / {book.subgenre}</span>}
        </dd>
      </div>

      {book.series && (
        <div>
          <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">シリーズ</dt>
          <dd className="text-gray-700">{book.series}</dd>
        </div>
      )}

      <div>
        <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">ISBN</dt>
        <dd className="text-gray-700">{book.isbn ?? '情報なし'}</dd>
      </div>

      <div>
        <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">ページ数</dt>
        <dd className="text-gray-700">{book.pages != null ? `${book.pages}ページ` : '情報なし'}</dd>
      </div>

      {(() => {
        const sources = Array.isArray(book.source) ? book.source : (book.source ? [book.source] : []);
        if (!sources.includes('amazon_kindle')) return null;
        return (
          <div>
            <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Kindle</dt>
            <dd>
              {book.asin
                ? (
                  <a
                    href={`https://www.amazon.co.jp/dp/${book.asin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Amazonで開く
                  </a>
                )
                : <span className="text-gray-700 text-sm">Kindleで所持</span>
              }
            </dd>
          </div>
        );
      })()}
    </dl>
  );
}
