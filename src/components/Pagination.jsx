export default function Pagination({ totalCount, pageSize, currentPage, onPageChange }) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  // Show page numbers: current ±2, plus first and last
  function getPageNumbers() {
    const pages = new Set([1, totalPages]);
    for (let i = currentPage - 2; i <= currentPage + 2; i++) {
      if (i >= 1 && i <= totalPages) pages.add(i);
    }
    return [...pages].sort((a, b) => a - b);
  }

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
      >
        ‹ 前
      </button>

      {pageNumbers.map((page, idx) => {
        const prev = pageNumbers[idx - 1];
        const showEllipsis = prev && page - prev > 1;
        return (
          <span key={page} className="flex items-center gap-1">
            {showEllipsis && (
              <span className="px-2 text-gray-400 text-sm">…</span>
            )}
            <button
              onClick={() => onPageChange(page)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                page === currentPage
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          </span>
        );
      })}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
      >
        次 ›
      </button>
    </div>
  );
}
