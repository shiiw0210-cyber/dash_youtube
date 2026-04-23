import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatNumber } from '../utils/formatters';
import type { DailyMetrics, VideoStats } from '../types';

interface Props {
  dailyMetrics: DailyMetrics[];
  videos: VideoStats[];
}

export function Charts({ dailyMetrics, videos }: Props) {
  const topVideos = [...videos]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 10)
    .map((v) => ({
      name: v.title.length > 20 ? v.title.slice(0, 20) + '…' : v.title,
      views: v.viewCount,
      likes: v.likeCount,
    }));

  const hasDaily = dailyMetrics.length > 0;
  const hasVideos = videos.length > 0;

  return (
    <div className="view-container">
      <h2 className="view-title">推移グラフ</h2>

      {!hasDaily && (
        <div className="info-banner">
          日別データは CSV インポートで追加できます（YouTube Studio → アナリティクス → CSV エクスポート）
        </div>
      )}

      {hasDaily && (
        <div className="chart-section">
          <h3 className="section-title">日別視聴回数</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyMetrics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
              <Tooltip formatter={(v: number) => [formatNumber(v), '視聴回数']} />
              <Line type="monotone" dataKey="views" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasDaily && (
        <div className="chart-section">
          <h3 className="section-title">チャンネル登録者数の推移</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dailyMetrics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
              <Tooltip formatter={(v: number) => [formatNumber(v), '登録者数']} />
              <Line type="monotone" dataKey="subscribers" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasVideos && (
        <div className="chart-section">
          <h3 className="section-title">動画別パフォーマンス TOP 10</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topVideos} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={150} />
              <Tooltip formatter={(v: number) => formatNumber(v)} />
              <Legend />
              <Bar dataKey="views" name="視聴回数" fill="#2563eb" radius={[0, 4, 4, 0]} />
              <Bar dataKey="likes" name="いいね数" fill="#ea580c" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!hasVideos && !hasDaily && (
        <div className="empty-state">
          <p>設定から API キーとチャンネル ID を入力してデータを読み込んでください。</p>
        </div>
      )}
    </div>
  );
}
