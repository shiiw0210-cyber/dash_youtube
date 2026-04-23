import { ExternalLink } from 'lucide-react';
import { formatNumber, formatDuration, formatDate } from '../utils/formatters';
import type { VideoStats } from '../types';

interface Props {
  videos: VideoStats[];
}

export function VideoTable({ videos }: Props) {
  const sorted = [...videos].sort((a, b) => b.viewCount - a.viewCount);

  if (videos.length === 0) {
    return (
      <div className="view-container">
        <h2 className="view-title">動画一覧</h2>
        <div className="empty-state">
          <p>設定から API キーとチャンネル ID を入力して動画データを読み込んでください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <h2 className="view-title">動画一覧 ({videos.length} 本)</h2>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>サムネイル</th>
              <th>タイトル</th>
              <th>公開日</th>
              <th>尺</th>
              <th>視聴回数</th>
              <th>いいね</th>
              <th>コメント</th>
              <th>CTR</th>
              <th>視聴時間</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => (
              <tr key={v.videoId}>
                <td>
                  {v.thumbnailUrl && (
                    <img src={v.thumbnailUrl} alt="" className="table-thumb" />
                  )}
                </td>
                <td className="title-cell">
                  <span className="video-title">{v.title}</span>
                </td>
                <td className="nowrap">{formatDate(v.publishedAt)}</td>
                <td className="nowrap">{formatDuration(v.duration)}</td>
                <td className="num-cell">{formatNumber(v.viewCount)}</td>
                <td className="num-cell">{formatNumber(v.likeCount)}</td>
                <td className="num-cell">{formatNumber(v.commentCount)}</td>
                <td className="num-cell">
                  {v.ctr !== undefined ? (v.ctr * 100).toFixed(1) + '%' : '—'}
                </td>
                <td className="num-cell">
                  {v.watchTimeMinutes !== undefined
                    ? formatNumber(Math.round(v.watchTimeMinutes)) + ' 分'
                    : '—'}
                </td>
                <td>
                  <a
                    href={`https://www.youtube.com/watch?v=${v.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ext-link"
                    title="YouTubeで開く"
                  >
                    <ExternalLink size={14} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
