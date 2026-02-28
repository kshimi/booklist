import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';

const BAR_COLOR = '#3b82f6';
const BAR_HOVER_COLOR = '#1d4ed8';

/**
 * GenreChart — horizontal bar chart of book count per genre
 * Props: genreStats ({ [genre]: count }), onSelectGenre (genre: string) => void
 */
export default function GenreChart({ genreStats, onSelectGenre }) {
  const data = Object.entries(genreStats)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-3">ジャンル別統計</h2>
      <div className="bg-white rounded-lg shadow-sm p-4">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="genre"
              width={130}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => [`${value}冊 (${((value / total) * 100).toFixed(1)}%)`, '冊数']}
              cursor={{ fill: '#f3f4f6' }}
            />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(entry) => onSelectGenre(entry.genre)}
              label={{ position: 'right', fontSize: 11, fill: '#6b7280', formatter: (v) => `${v}冊` }}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.genre}
                  fill={BAR_COLOR}
                  onMouseEnter={(e) => { e.target.setAttribute('fill', BAR_HOVER_COLOR); }}
                  onMouseLeave={(e) => { e.target.setAttribute('fill', BAR_COLOR); }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 mt-2 text-center">
          クリックすると書籍一覧をそのジャンルで絞り込みます
        </p>
      </div>
    </div>
  );
}
