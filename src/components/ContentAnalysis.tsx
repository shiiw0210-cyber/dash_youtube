import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Hash, Clock, Tag } from 'lucide-react';
import { analyzeKeywords } from '../utils/textAnalysis';
import { groupByLength } from '../utils/videoAnalysis';
import { detectSeries } from '../utils/seriesDetection';
import { formatNumber, formatDuration } from '../utils/formatters';
import type { VideoStats } from '../types';

interface Props {
  videos: VideoStats[];
}

type Tab = 'keywords' | 'length' | 'series';

export function ContentAnalysis({ videos }: Props) {
  const [tab, setTab] = useState<Tab>('keywords');

  const keywords = useMemo(() => analyzeKeywords(videos, 2).slice(0, 25), [videos]);
  const lengthBuckets = useMemo(() => groupByLength(videos), [videos]);
  const series = useMemo(() => detectSeries(videos, 2), [videos]);

  const channelAvgViews =
    videos.length > 0 ? videos.reduce((s, v) => s + v.viewCount, 0) / videos.length : 0;

  if (videos.length === 0) {
    return (
      <div className="view-container">
        <h2 className="view-title">コンテンツ分析</h2>
        <div className="empty-state">
          <p>動画データが必要です。設定から API キーとチャンネル ID を入力してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <h2 className="view-title">コンテンツ分析</h2>

      <div className="tab-group">
        <button
          className={`tab ${tab === 'keywords' ? 'tab--active' : ''}`}
          onClick={() => setTab('keywords')}
        >
          <Hash size={14} /> キーワード
        </button>
        <button
          className={`tab ${tab === 'length' ? 'tab--active' : ''}`}
          onClick={() => setTab('length')}
        >
          <Clock size={14} /> 動画の長さ
        </button>
        <button
          className={`tab ${tab === 'series' ? 'tab--active' : ''}`}
          onClick={() => setTab('series')}
        >
          <Tag size={14} /> シリーズ・出演者
        </button>
      </div>

      {tab === 'keywords' && (
        <KeywordsTab keywords={keywords} channelAvg={channelAvgViews} />
      )}
      {tab === 'length' && <LengthTab buckets={lengthBuckets} />}
      {tab === 'series' && <SeriesTab series={series} channelAvg={channelAvgViews} />}
    </div>
  );
}

function KeywordsTab({
  keywords,
  channelAvg,
}: {
  keywords: ReturnType<typeof analyzeKeywords>;
  channelAvg: number;
}) {
  if (keywords.length === 0) {
    return <div className="empty-state"><p>2本以上で共通するキーワードがありません。</p></div>;
  }

  const chartData = keywords.slice(0, 15).map((k) => ({
    name: k.word,
    avgViews: Math.round(k.avgViews),
    count: k.count,
    aboveAvg: k.avgViews >= channelAvg,
  }));

  return (
    <>
      <div className="info-banner">
        タイトルに含まれる2〜4文字のキーワードを抽出し、そのキーワードを含む動画の<strong>平均再生数</strong>を表示しています。チャンネル平均（{formatNumber(Math.round(channelAvg))}）を超えるキーワードは<span style={{ color: '#16a34a' }}> 緑 </span>、下回るキーワードは<span style={{ color: '#dc2626' }}> 赤 </span>です。
      </div>

      <div className="chart-section">
        <h3 className="section-title">キーワード × 平均再生数 TOP 15</h3>
        <ResponsiveContainer width="100%" height={Math.max(380, chartData.length * 28)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
            <Tooltip
              formatter={(value, _name, entry) => {
                const count = (entry?.payload as { count?: number } | undefined)?.count ?? 0;
                return [`${formatNumber(value as number)} 回（${count} 本）`, '平均再生数'];
              }}
            />
            <Bar dataKey="avgViews" radius={[0, 4, 4, 0]}>
              {chartData.map((e, i) => (
                <Cell key={i} fill={e.aboveAvg ? '#16a34a' : '#dc2626'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>キーワード</th>
              <th className="num-cell">出現動画数</th>
              <th className="num-cell">平均再生数</th>
              <th className="num-cell">平均いいね</th>
              <th className="num-cell">VS チャンネル平均</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((k) => {
              const ratio = channelAvg > 0 ? k.avgViews / channelAvg : 0;
              return (
                <tr key={k.word}>
                  <td><strong>{k.word}</strong></td>
                  <td className="num-cell">{k.count}</td>
                  <td className="num-cell">{formatNumber(Math.round(k.avgViews))}</td>
                  <td className="num-cell">{formatNumber(Math.round(k.avgLikes))}</td>
                  <td className="num-cell" style={{ color: ratio >= 1 ? '#16a34a' : '#dc2626' }}>
                    {ratio >= 1 ? '+' : ''}{((ratio - 1) * 100).toFixed(0)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LengthTab({ buckets }: { buckets: ReturnType<typeof groupByLength> }) {
  if (buckets.length === 0) {
    return <div className="empty-state"><p>動画データが不足しています。</p></div>;
  }

  const chartData = buckets.map((b) => ({
    name: b.label,
    avgViews: Math.round(b.avgViews),
    count: b.count,
    likeRate: b.likeRate * 100,
  }));

  return (
    <>
      <div className="info-banner">
        動画の尺ごとに平均再生数・本数・いいね率を比較しています。どの長さが最もリーチしているかを把握してください。
      </div>

      <div className="chart-section">
        <h3 className="section-title">動画の長さ × 平均再生数</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
            <Tooltip
              formatter={(value, _name, entry) => {
                const count = (entry?.payload as { count?: number } | undefined)?.count ?? 0;
                return [`${formatNumber(value as number)} 回（${count} 本）`, '平均再生数'];
              }}
            />
            <Bar dataKey="avgViews" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>尺</th>
              <th className="num-cell">本数</th>
              <th className="num-cell">平均再生数</th>
              <th className="num-cell">平均いいね</th>
              <th className="num-cell">いいね率</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.label}>
                <td><strong>{b.label}</strong></td>
                <td className="num-cell">{b.count}</td>
                <td className="num-cell">{formatNumber(Math.round(b.avgViews))}</td>
                <td className="num-cell">{formatNumber(Math.round(b.avgLikes))}</td>
                <td className="num-cell">{(b.likeRate * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SeriesTab({
  series,
  channelAvg,
}: {
  series: ReturnType<typeof detectSeries>;
  channelAvg: number;
}) {
  if (series.length === 0) {
    return (
      <div className="empty-state">
        <p>シリーズ・出演者のパターンが検出されませんでした。タイトルに【】で統一ラベルを付けたり、「〇〇先生」のような表記を入れると検出されやすくなります。</p>
      </div>
    );
  }

  const typeLabel: Record<string, string> = {
    bracket: 'ラベル',
    prefix: 'シリーズ',
    performer: '出演者',
  };
  const typeColor: Record<string, string> = {
    bracket: '#9333ea',
    prefix: '#2563eb',
    performer: '#ea580c',
  };

  return (
    <>
      <div className="info-banner">
        タイトルから自動的に【】で囲まれたラベル・共通プレフィックス・出演者（〇〇先生/さん/院長 等）を検出しています。チャンネル平均（{formatNumber(Math.round(channelAvg))}）を基準に、どのパターンが伸びているかを確認できます。
      </div>

      <div className="series-grid">
        {series.map((s) => {
          const ratio = channelAvg > 0 ? s.avgViews / channelAvg : 0;
          return (
            <div key={s.pattern} className="series-card">
              <div className="series-header">
                <span
                  className="series-type-badge"
                  style={{ background: typeColor[s.type] + '22', color: typeColor[s.type] }}
                >
                  {typeLabel[s.type]}
                </span>
                <span className="series-count">{s.count} 本</span>
              </div>
              <h4 className="series-label">{s.label}</h4>
              <div className="series-metrics">
                <div>
                  <span className="series-metric-label">平均再生数</span>
                  <strong>{formatNumber(Math.round(s.avgViews))}</strong>
                </div>
                <div>
                  <span className="series-metric-label">VS 平均</span>
                  <strong style={{ color: ratio >= 1 ? '#16a34a' : '#dc2626' }}>
                    {ratio >= 1 ? '+' : ''}{((ratio - 1) * 100).toFixed(0)}%
                  </strong>
                </div>
              </div>
              <details className="series-details">
                <summary>動画一覧 ({s.count})</summary>
                <ul>
                  {[...s.videos]
                    .sort((a, b) => b.viewCount - a.viewCount)
                    .map((v) => (
                      <li key={v.videoId}>
                        <a
                          href={`https://www.youtube.com/watch?v=${v.videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {v.title}
                        </a>
                        <span className="series-video-stats">
                          {formatNumber(v.viewCount)} 回 · {formatDuration(v.duration)}
                        </span>
                      </li>
                    ))}
                </ul>
              </details>
            </div>
          );
        })}
      </div>
    </>
  );
}
