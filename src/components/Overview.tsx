import { Eye, Users, Clock, ThumbsUp } from 'lucide-react';
import { StatCard } from './StatCard';
import { formatNumber, formatWatchTime } from '../utils/formatters';
import type { ChannelStats, VideoStats } from '../types';

interface Props {
  channel: ChannelStats | null;
  videos: VideoStats[];
}

export function Overview({ channel, videos }: Props) {
  const totalLikes = videos.reduce((s, v) => s + v.likeCount, 0);
  const totalViews = videos.reduce((s, v) => s + v.viewCount, 0);
  const totalWatchMin = videos.reduce((s, v) => s + (v.watchTimeMinutes ?? 0), 0);

  return (
    <div className="view-container">
      <h2 className="view-title">ダッシュボード</h2>

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
          sub="CSVインポートで取得"
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
