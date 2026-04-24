import { Eye, Users, Clock, ThumbsUp, DollarSign, MousePointerClick, Activity, AlertCircle } from 'lucide-react';
import { StatCard } from './StatCard';
import { formatNumber, formatWatchTime } from '../utils/formatters';
import type { ChannelStats, VideoStats, AnalyticsTotals } from '../types';

interface Props {
  channel: ChannelStats | null;
  videos: VideoStats[];
  analyticsTotals?: AnalyticsTotals | null;
  analyticsError?: string | null;
}

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function Overview({ channel, videos, analyticsTotals, analyticsError }: Props) {
  const totalLikes = videos.reduce((s, v) => s + v.likeCount, 0);
  const totalViews = videos.reduce((s, v) => s + v.viewCount, 0);
  const totalWatchMin =
    analyticsTotals?.estimatedMinutesWatched ??
    videos.reduce((s, v) => s + (v.watchTimeMinutes ?? 0), 0);

  const revenue = analyticsTotals?.estimatedRevenue;
  const impressions = analyticsTotals?.impressions;
  const avgCtr = analyticsTotals?.averageCtr;

  const retentionValues = videos
    .map((v) => v.averageViewPercentage)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const avgRetention =
    retentionValues.length > 0
      ? retentionValues.reduce((s, v) => s + v, 0) / retentionValues.length
      : undefined;

  return (
    <div className="view-container">
      <h2 className="view-title">ダッシュボード</h2>

      {analyticsError && (
        <div className="info-banner" style={{ background: '#fef3c7', borderColor: '#fcd34d', color: '#92400e', marginBottom: 16 }}>
          <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          <strong>Analytics データ取得エラー:</strong> {analyticsError}
          <br />
          <span style={{ fontSize: 12 }}>
            設定画面の「YouTube Analytics（OAuth 連携）」セクションで環境変数を登録してください。
          </span>
        </div>
      )}

      <div className="stat-grid">
        <StatCard
          label="総視聴回数"
          value={formatNumber(channel?.viewCount ?? totalViews)}
          sub={channel ? '累計' : `直近${videos.length}本`}
          icon={<Eye size={22} />}
          color="#2563eb"
        />
        <StatCard
          label="チャンネル登録者数"
          value={formatNumber(channel?.subscriberCount ?? 0)}
          icon={<Users size={22} />}
          color="#16a34a"
        />
        <StatCard
          label="総視聴時間"
          value={totalWatchMin > 0 ? formatWatchTime(totalWatchMin) : '—'}
          sub={analyticsTotals ? 'Analytics 自動取得' : 'CSVインポートで取得'}
          icon={<Clock size={22} />}
          color="#9333ea"
        />
        <StatCard
          label="総いいね数"
          value={formatNumber(totalLikes)}
          sub={`動画 ${channel?.videoCount ?? videos.length} 本`}
          icon={<ThumbsUp size={22} />}
          color="#ea580c"
        />
      </div>

      {analyticsTotals && (
        <>
          <h3 className="section-title" style={{ marginTop: 28, marginBottom: 12 }}>
            Analytics サマリー（全期間）
          </h3>
          <div className="stat-grid">
            <StatCard
              label="推定収益"
              value={revenue !== undefined ? formatUsd(revenue) : '—'}
              sub={revenue === undefined ? '収益化していない可能性' : 'USD 推定'}
              icon={<DollarSign size={22} />}
              color="#16a34a"
            />
            <StatCard
              label="インプレッション"
              value={impressions !== undefined ? formatNumber(impressions) : '—'}
              sub="サムネ表示回数"
              icon={<MousePointerClick size={22} />}
              color="#2563eb"
            />
            <StatCard
              label="平均 CTR"
              value={avgCtr !== undefined ? `${(avgCtr * 100).toFixed(1)}%` : '—'}
              sub="クリック率"
              icon={<MousePointerClick size={22} />}
              color="#dc2626"
            />
            <StatCard
              label="平均視聴維持率"
              value={avgRetention !== undefined ? `${avgRetention.toFixed(1)}%` : '—'}
              sub={`${retentionValues.length} 本の平均`}
              icon={<Activity size={22} />}
              color="#9333ea"
            />
          </div>
        </>
      )}

      {videos.length > 0 && (
        <div className="section">
          <h3 className="section-title">人気動画 TOP 5</h3>
          <div className="top-videos">
            {[...videos]
              .sort((a, b) => b.viewCount - a.viewCount)
              .slice(0, 5)
              .map((v, i) => (
                <div key={v.videoId} className="top-video-item">
                  <span className="top-rank">#{i + 1}</span>
                  {v.thumbnailUrl && (
                    <img src={v.thumbnailUrl} alt="" className="top-thumb" />
                  )}
                  <div className="top-info">
                    <p className="top-title">{v.title}</p>
                    <p className="top-meta">
                      {formatNumber(v.viewCount)} 回視聴 ·
                      <span className="like-badge"> ♥ {formatNumber(v.likeCount)}</span>
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {videos.length === 0 && (
        <div className="empty-state">
          <p>設定から API キーとチャンネル ID を入力して、データを読み込んでください。</p>
        </div>
      )}
    </div>
  );
}
