import { useMemo, useState } from 'react';
import { ExternalLink, MousePointerClick } from 'lucide-react';
import { formatNumber } from '../utils/formatters';
import type { VideoStats } from '../types';

interface Props {
  videos: VideoStats[];
}

const TOP_N_OPTIONS = [10, 20, 50, 100] as const;
type TopN = (typeof TOP_N_OPTIONS)[number] | 'all';

export function CtrRanking({ videos }: Props) {
  const [topN, setTopN] = useState<TopN>(20);

  const ranked = useMemo(() => {
    return [...videos]
      .filter((v) => v.ctr !== undefined && v.ctr > 0)
      .sort((a, b) => (b.ctr ?? 0) - (a.ctr ?? 0));
  }, [videos]);

  const visible = topN === 'all' ? ranked : ranked.slice(0, topN);

  if (videos.length === 0) {
    return (
      <div className="view-container">
        <h2 className="view-title">CTR ランキング</h2>
        <div className="empty-state">
          <p>動画データが必要です。設定から API を実行してください。</p>
        </div>
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <div className="view-container">
        <h2 className="view-title">CTR ランキング</h2>
        <div className="empty-state">
          <p>
            CTR データはまだ取り込まれていません。
            <br />
            <strong>CSV インポート</strong> から YouTube Studio の「動画別データ」CSV をアップロードしてください。
          </p>
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            YouTube Studio → アナリティクス → 詳細モード → 「インプレッションのクリック率」列を含む CSV をエクスポート
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="title-row">
        <h2 className="view-title" style={{ marginBottom: 0 }}>
          CTR ランキング
        </h2>
        <div className="ctr-rank-controls">
          <label className="ctr-rank-control-label">表示件数</label>
          <select
            className="form-input ctr-rank-select"
            value={String(topN)}
            onChange={(e) => {
              const v = e.target.value;
              setTopN(v === 'all' ? 'all' : (Number(v) as TopN));
            }}
          >
            {TOP_N_OPTIONS.map((n) => (
              <option key={n} value={n}>
                Top {n}
              </option>
            ))}
            <option value="all">全 {ranked.length} 本</option>
          </select>
        </div>
      </div>

      <p className="ctr-rank-subtitle">
        <MousePointerClick size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        インプレッションのクリック率（CTR）が高い順に表示。サムネイルのクリック誘引力がわかります。
      </p>

      <div className="ctr-rank-list">
        {visible.map((v, i) => {
          const rank = i + 1;
          const ctrPct = ((v.ctr ?? 0) * 100).toFixed(1);
          const tier =
            rank <= 3 ? 'ctr-rank-item--gold'
            : rank <= 10 ? 'ctr-rank-item--silver'
            : '';

          return (
            <div key={v.videoId} className={`ctr-rank-item ${tier}`}>
              <div className="ctr-rank-badge">{rank}</div>
              {v.thumbnailUrl && (
                <a
                  href={`https://www.youtube.com/watch?v=${v.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ctr-rank-thumb-link"
                  title="YouTube で開く"
                >
                  <img src={v.thumbnailUrl} alt="" className="ctr-rank-thumb" />
                </a>
              )}
              <div className="ctr-rank-body">
                <h4 className="ctr-rank-title" title={v.title}>
                  {v.title}
                </h4>
                <div className="ctr-rank-metrics">
                  <span className="ctr-rank-metric ctr-rank-metric--primary">
                    CTR <strong>{ctrPct}%</strong>
                  </span>
                  {v.impressions !== undefined && v.impressions > 0 && (
                    <span className="ctr-rank-metric">
                      インプレッション: <strong>{formatNumber(v.impressions)}</strong>
                    </span>
                  )}
                  <span className="ctr-rank-metric">
                    再生数: <strong>{formatNumber(v.viewCount)}</strong>
                  </span>
                </div>
              </div>
              <a
                href={`https://studio.youtube.com/video/${v.videoId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary ctr-rank-action"
                title="YouTube Studio で編集"
              >
                <ExternalLink size={14} /> Studio
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
