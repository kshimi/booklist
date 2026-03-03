import { useExternalBookData } from '../hooks/useExternalBookData';
import LoadingSpinner from './LoadingSpinner';
import ExternalBookDetails from './ExternalBookDetails';

export default function BookExternalInfo({ isbn, preloaded }) {
  const { data, status } = useExternalBookData(isbn || null, preloaded);

  if (status === 'idle') return null;

  return (
    <div className="border-t border-gray-100 pt-4">
      <h3 className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">
        外部書誌情報
      </h3>
      {status === 'loading' && <LoadingSpinner />}
      {status === 'loaded' && data && <ExternalBookDetails data={data} />}
      {status === 'not_found' && (
        <p className="text-sm text-gray-400">外部書誌情報なし</p>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-400">外部情報の取得に失敗しました</p>
      )}
    </div>
  );
}
