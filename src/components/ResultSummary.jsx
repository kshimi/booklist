import { PAGE_SIZE } from '../constants';

export default function ResultSummary({ totalCount, currentPage, pageSize = PAGE_SIZE }) {
  if (totalCount === 0) {
    return <p className="text-sm text-gray-500">0件</p>;
  }
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);
  return (
    <p className="text-sm text-gray-500">
      {start}–{end} / {totalCount}件
    </p>
  );
}
