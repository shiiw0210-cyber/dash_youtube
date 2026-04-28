import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import {
  Flame, TrendingUp, Clock3, Pencil, Save, X as IconX, ListChecks,
} from 'lucide-react';
import {
  computeViralMetrics, groupByDayOfWeek, groupByHourBand, comparePatterns,
  TIER_LABEL, TIER_COLOR, type ViralMetric, type ViralTier,
} from '../utils/viralAnalysis';
import { formatNumber, formatDate, formatDuration } from '../utils/formatters';
import type { VideoStats, ViralExtras } from '../types';

interface Props {
  videos: VideoStats[];
  extrasMap: Record<string, ViralExtras>;
  onUpdateExtras: (videoId: string, patch: Partial<ViralExtras>) => void;
  onClearExtras: (videoId: string) => void;
}

type Tab = 'ranking' | 'timing' | 'patterns' | 'manual';

export function ViralAnalysis({ videos, extrasMap, onUpdateExtras, onClearExtras }: Props) {
  const [tab, setTab] = useState<Tab>('ranking');

  const metrics = useMemo(
    () => computeViralMetrics(videos, extrasMap),
    [videos, extrasMap]
  );

  if (videos.length === 0) {
    return (
      <div className="view-container">
        <h2 className="view-title">伸びる動画分析</h2>
        <div className="empty-state">
          <p>動画データが必要です。設定から API キーとチャンネル ID を入力してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <h2 className="view-title">伸びる動画分析</h2>

      <div className="tab-group">
        <button className={`tab ${tab === 'ranking' ? 'tab--active' : ''}`} onClick={() => setTab('ranking')}>
          <Flame size={14} /> スコアランキング
        </button>
        <button className={`tab ${tab === 'timing' ? 'tab--active' : ''}`} onClick={() => setTab('timing')}>
          <Clock3 size={14} /> 公開タイミング
        </button>
        <button className={`tab ${tab === 'patterns' ? 'tab--active' : ''}`} onClick={() => setTab('patterns')}>
          <TrendingUp size={14} /> 上位 vs 下位の差分
        </button>
        <button className={`tab ${tab === 'manual' ? 'tab--active' : ''}`} onClick={() => setTab('manual')}>
          <Pencil size={14} /> 手入力データ
        </button>
      </div>

      {tab === 'ranking' && <RankingTab metrics={metrics} />}
      {tab === 'timing' && <TimingTab metrics={metrics} />}
      {tab === 'patterns' && <PatternsTab metrics={metrics} />}
      {tab === 'manual' && (
        <ManualTab
          metrics={metrics}
          onUpdateExtras={onUpdateExtras}
          onClearExtras={onClearExtras}
        />
      )}
    </div>
  );
}

/* ====================== Ranking Tab ====================== */

function RankingTab({ metrics }: { metrics: ViralMetric[] }) {
  const sorted = useMemo(
    () => [...metrics].sort((a, b) => b.viralScore - a.viralScore),
    [metrics]
  );

  const tierCounts = useMemo(() => {
    const counts: Record<ViralTier, number> = {
      viral: 0, hit: 0, normal: 0, underperform: 0,
    };
    for (const m of metrics) counts[m.tier]++;
    return counts;
  }, [metrics]);

  const scatter = useMemo(
    () => sorted.map((m) => ({
      x: m.daysSincePublish,
      y: m.viewVelocity,
      z: Math.max(20, m.viralScore),
      name: m.video.title,
      tier: m.tier,
    })),
    [sorted]
  );

  const top = sorted.slice(0, 30);

  return (
    <>
      <div className="info-banner">
        <strong>バイラルスコア</strong>は <em>視聴速度（再生数 ÷ 公開日数）</em>・<em>エンゲージメント率</em>・<em>CTR</em>・<em>視聴維持率</em>・<em>初速 (24h 手入力)</em> をチャンネル中央値で正規化して 0〜100 で算出します。
      </div>

      <div className="viral-tier-summary">
        {(Object.keys(TIER_LABEL) as ViralTier[]).map((tier) => (
          <div key={tier} className="viral-tier-card" style={{ borderLeftColor: TIER_COLOR[tier] }}>
            <span className="viral-tier-label" style={{ color: TIER_COLOR[tier] }}>{TIER_LABEL[tier]}</span>
            <strong className="viral-tier-count">{tierCounts[tier]} 本</strong>
          </div>
        ))}
      </div>

      <div className="chart-section">
        <h3 className="section-title">公開からの経過日数 × 1日あたり再生数</h3>
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              type="number"
              dataKey="x"
              name="経過日数"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${Math.round(v)}日`}
              scale="log"
              domain={['auto', 'auto']}
              allowDataOverflow
            />
            <YAxis
              type="number"
              dataKey="y"
              name="日次視聴速度"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => formatNumber(v)}
              scale="log"
              domain={['auto', 'auto']}
              allowDataOverflow
            />
            <ZAxis type="number" dataKey="z" range={[40, 320]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(value: number, name: string) => {
                if (name === '経過日数') return [`${Math.round(value)} 日`, name];
                if (name === '日次視聴速度') return [`${formatNumber(Math.round(value))} 回/日`, name];
                return [value, name];
              }}
              labelFormatter={() => ''}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { name: string; x: number; y: number; tier: ViralTier };
                return (
                  <div className="recharts-tooltip-custom">
                    <div className="tt-title">{p.name}</div>
                    <div>{Math.round(p.x)} 日経過 / {formatNumber(Math.round(p.y))} 回/日</div>
                    <div style={{ color: TIER_COLOR[p.tier] }}>{TIER_LABEL[p.tier]}</div>
                  </div>
                );
              }}
            />
            {(Object.keys(TIER_LABEL) as ViralTier[]).map((tier) => (
              <Scatter
                key={tier}
                name={TIER_LABEL[tier]}
                data={scatter.filter((s) => s.tier === tier)}
                fill={TIER_COLOR[tier]}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>動画</th>
              <th className="num-cell">スコア</th>
              <th className="num-cell">階層</th>
              <th className="num-cell">日次再生</th>
              <th className="num-cell">公開</th>
              <th className="num-cell">エンゲージ</th>
              <th className="num-cell">CTR</th>
              <th className="num-cell">維持率</th>
            </tr>
          </thead>
          <tbody>
            {top.map((m, i) => (
              <tr key={m.video.videoId}>
                <td>{i + 1}</td>
                <td>
                  <a
                    href={`https://www.youtube.com/watch?v=${m.video.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="video-cell-link"
                  >
                    {m.video.title}
                  </a>
                </td>
                <td className="num-cell"><strong>{m.viralScore}</strong></td>
                <td className="num-cell">
                  <span
                    className="tier-badge"
                    style={{ background: TIER_COLOR[m.tier] + '22', color: TIER_COLOR[m.tier] }}
                  >
                    {TIER_LABEL[m.tier]}
                  </span>
                </td>
                <td className="num-cell">{formatNumber(Math.round(m.viewVelocity))}/日</td>
                <td className="num-cell">{formatDate(m.video.publishedAt)}</td>
                <td className="num-cell">{(m.engagementRate * 100).toFixed(2)}%</td>
                <td className="num-cell">{m.ctr != null ? (m.ctr * 100).toFixed(1) + '%' : '—'}</td>
                <td className="num-cell">
                  {m.retentionRatio != null ? (m.retentionRatio * 100).toFixed(0) + '%' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ====================== Timing Tab ====================== */

function TimingTab({ metrics }: { metrics: ViralMetric[] }) {
  const dow = useMemo(() => groupByDayOfWeek(metrics), [metrics]);
  const hour = useMemo(() => groupByHourBand(metrics), [metrics]);

  return (
    <>
      <div className="info-banner">
        投稿曜日・時間帯ごとに <strong>平均バイラルスコア</strong>と<strong>平均再生数</strong>を比較します。本数が偏っている場合は参考値として扱ってください。
      </div>

      <div className="chart-section">
        <h3 className="section-title">曜日別 平均スコア</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={dow} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number, _n, entry) => {
                const c = (entry?.payload as { count?: number } | undefined)?.count ?? 0;
                return [`${v.toFixed(1)} 点 (${c} 本)`, '平均スコア'];
              }}
            />
            <Bar dataKey="avgScore" radius={[4, 4, 0, 0]}>
              {dow.map((b, i) => (
                <Cell key={i} fill={b.avgScore >= 50 ? '#16a34a' : '#9ca3af'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-section">
        <h3 className="section-title">時間帯別 平均スコア</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={hour} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={70} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number, _n, entry) => {
                const c = (entry?.payload as { count?: number } | undefined)?.count ?? 0;
                return [`${v.toFixed(1)} 点 (${c} 本)`, '平均スコア'];
              }}
            />
            <Bar dataKey="avgScore" radius={[4, 4, 0, 0]}>
              {hour.map((b, i) => (
                <Cell key={i} fill={b.avgScore >= 50 ? '#16a34a' : '#9ca3af'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="timing-tables">
        <div className="table-wrapper">
          <h4 className="section-title">曜日別 詳細</h4>
          <table className="data-table">
            <thead>
              <tr><th>曜日</th><th className="num-cell">本数</th><th className="num-cell">平均スコア</th><th className="num-cell">平均再生</th></tr>
            </thead>
            <tbody>
              {dow.map((b) => (
                <tr key={b.key}>
                  <td>{b.label}</td>
                  <td className="num-cell">{b.count}</td>
                  <td className="num-cell">{b.avgScore.toFixed(1)}</td>
                  <td className="num-cell">{formatNumber(Math.round(b.avgViews))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrapper">
          <h4 className="section-title">時間帯 詳細</h4>
          <table className="data-table">
            <thead>
              <tr><th>時間帯</th><th className="num-cell">本数</th><th className="num-cell">平均スコア</th><th className="num-cell">平均再生</th></tr>
            </thead>
            <tbody>
              {hour.map((b) => (
                <tr key={b.key}>
                  <td>{b.label}</td>
                  <td className="num-cell">{b.count}</td>
                  <td className="num-cell">{b.avgScore.toFixed(1)}</td>
                  <td className="num-cell">{formatNumber(Math.round(b.avgViews))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ====================== Patterns Tab ====================== */

function PatternsTab({ metrics }: { metrics: ViralMetric[] }) {
  const patterns = useMemo(() => comparePatterns(metrics), [metrics]);

  const TYPE_LABEL: Record<string, string> = {
    length: '動画の長さ',
    keyword: 'キーワード',
    tag: '手入力タグ',
    dayOfWeek: '曜日',
    hourBand: '時間帯',
  };

  if (patterns.length === 0) {
    return (
      <div className="empty-state">
        <p>上位（バイラル/ヒット）と下位（伸び悩み）の両方に十分な動画数がないため差分が計算できません。</p>
      </div>
    );
  }

  return (
    <>
      <div className="info-banner">
        <strong>上位</strong>（バイラル + ヒット）と <strong>下位</strong>（伸び悩み）に占める各特徴の割合を比較し、リフト（=上位率 ÷ 下位率）が大きい順に並べています。<br />
        <em>1.0 を大きく超える</em>ものは「伸びる動画」に多い特徴、<em>1.0 を大きく下回る</em>ものは「伸び悩み」動画に多い特徴です。
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>カテゴリ</th>
              <th>特徴</th>
              <th className="num-cell">上位 出現</th>
              <th className="num-cell">下位 出現</th>
              <th className="num-cell">リフト</th>
            </tr>
          </thead>
          <tbody>
            {patterns.map((p) => (
              <tr key={p.type + ':' + p.label}>
                <td><span className="pill">{TYPE_LABEL[p.type] ?? p.type}</span></td>
                <td><strong>{p.label}</strong></td>
                <td className="num-cell">{p.topCount} 本 ({(p.topShare * 100).toFixed(0)}%)</td>
                <td className="num-cell">{p.bottomCount} 本 ({(p.bottomShare * 100).toFixed(0)}%)</td>
                <td
                  className="num-cell"
                  style={{ color: p.lift >= 1.3 ? '#16a34a' : p.lift <= 0.7 ? '#dc2626' : '#6b7280', fontWeight: 600 }}
                >
                  ×{p.lift.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ====================== Manual Input Tab ====================== */

function ManualTab({
  metrics,
  onUpdateExtras,
  onClearExtras,
}: {
  metrics: ViralMetric[];
  onUpdateExtras: (id: string, patch: Partial<ViralExtras>) => void;
  onClearExtras: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'filled' | 'missing'>('all');

  const sorted = useMemo(
    () => [...metrics].sort(
      (a, b) => new Date(b.video.publishedAt).getTime() - new Date(a.video.publishedAt).getTime()
    ),
    [metrics]
  );

  const filtered = useMemo(() => {
    if (filter === 'filled') return sorted.filter((m) => m.extras);
    if (filter === 'missing') return sorted.filter((m) => !m.extras);
    return sorted;
  }, [sorted, filter]);

  const filledCount = sorted.filter((m) => m.extras).length;

  return (
    <>
      <div className="info-banner">
        YouTube Data API では取得できない <strong>初動 (24h/48h/72h/7d 視聴)</strong>・<strong>視聴維持率</strong>・<strong>登録者獲得数</strong>・<strong>トラフィックソース</strong>・<strong>主観タグ</strong>を動画単位で入力できます。<br />
        入力すると<strong>バイラルスコアの精度が上がり</strong>、「上位 vs 下位」のパターン分析にもタグが反映されます。データはブラウザの localStorage に保存されます。
      </div>
      <div className="manual-toolbar">
        <span>入力済み: <strong>{filledCount}</strong> / {sorted.length} 本</span>
        <div className="manual-filter">
          <button className={`tab ${filter === 'all' ? 'tab--active' : ''}`} onClick={() => setFilter('all')}>
            <ListChecks size={13} /> すべて
          </button>
          <button className={`tab ${filter === 'filled' ? 'tab--active' : ''}`} onClick={() => setFilter('filled')}>
            入力済み
          </button>
          <button className={`tab ${filter === 'missing' ? 'tab--active' : ''}`} onClick={() => setFilter('missing')}>
            未入力
          </button>
        </div>
      </div>

      <div className="manual-list">
        {filtered.map((m) => (
          <ManualRow
            key={m.video.videoId}
            metric={m}
            editing={editing === m.video.videoId}
            onEdit={() => setEditing(m.video.videoId)}
            onCancel={() => setEditing(null)}
            onSave={(patch) => {
              onUpdateExtras(m.video.videoId, patch);
              setEditing(null);
            }}
            onClear={() => onClearExtras(m.video.videoId)}
          />
        ))}
      </div>
    </>
  );
}

function ManualRow({
  metric,
  editing,
  onEdit,
  onCancel,
  onSave,
  onClear,
}: {
  metric: ViralMetric;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<ViralExtras>) => void;
  onClear: () => void;
}) {
  const e = metric.extras;
  if (!editing) {
    return (
      <div className="manual-row">
        <img src={metric.video.thumbnailUrl} alt="" className="manual-thumb" />
        <div className="manual-body">
          <div className="manual-title">
            <a href={`https://www.youtube.com/watch?v=${metric.video.videoId}`} target="_blank" rel="noopener noreferrer">
              {metric.video.title}
            </a>
          </div>
          <div className="manual-meta">
            {formatDate(metric.video.publishedAt)} · {formatDuration(metric.video.duration)} · {formatNumber(metric.video.viewCount)} 回 · スコア {metric.viralScore}
          </div>
          <div className="manual-extras">
            <Field label="24h" value={e?.views24h} fmt={(v) => formatNumber(v)} />
            <Field label="48h" value={e?.views48h} fmt={(v) => formatNumber(v)} />
            <Field label="72h" value={e?.views72h} fmt={(v) => formatNumber(v)} />
            <Field label="7日" value={e?.views7d} fmt={(v) => formatNumber(v)} />
            <Field label="登録獲得" value={e?.subscribersGained} fmt={(v) => formatNumber(v) + '人'} />
            <Field label="維持率" value={e?.audienceRetentionPct} fmt={(v) => v.toFixed(0) + '%'} />
            <Field label="ブラウジング" value={e?.trafficBrowse} fmt={(v) => v.toFixed(0) + '%'} />
            <Field label="検索" value={e?.trafficSearch} fmt={(v) => v.toFixed(0) + '%'} />
            <Field label="関連" value={e?.trafficSuggested} fmt={(v) => v.toFixed(0) + '%'} />
            <Field label="外部" value={e?.trafficExternal} fmt={(v) => v.toFixed(0) + '%'} />
          </div>
          {e?.tags && e.tags.length > 0 && (
            <div className="manual-tags">
              {e.tags.map((t) => (
                <span key={t} className="pill">{t}</span>
              ))}
            </div>
          )}
          {e?.notes && <div className="manual-notes">{e.notes}</div>}
        </div>
        <div className="manual-actions">
          <button className="btn btn-secondary" onClick={onEdit}>
            <Pencil size={14} /> 編集
          </button>
          {e && (
            <button className="icon-btn icon-btn--danger" onClick={onClear} title="このデータを削除" aria-label="削除">
              <IconX size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <ManualEditForm
      initial={e}
      thumbnailUrl={metric.video.thumbnailUrl}
      title={metric.video.title}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
}

function Field({ label, value, fmt }: { label: string; value?: number; fmt: (v: number) => string }) {
  return (
    <span className="manual-field">
      <span className="manual-field-label">{label}</span>
      <span className="manual-field-value">{value != null ? fmt(value) : '—'}</span>
    </span>
  );
}

function ManualEditForm({
  initial,
  thumbnailUrl,
  title,
  onCancel,
  onSave,
}: {
  initial?: ViralExtras;
  thumbnailUrl: string;
  title: string;
  onCancel: () => void;
  onSave: (patch: Partial<ViralExtras>) => void;
}) {
  const [form, setForm] = useState<Partial<ViralExtras>>(() => ({
    views24h: initial?.views24h,
    views48h: initial?.views48h,
    views72h: initial?.views72h,
    views7d: initial?.views7d,
    subscribersGained: initial?.subscribersGained,
    audienceRetentionPct: initial?.audienceRetentionPct,
    trafficBrowse: initial?.trafficBrowse,
    trafficSearch: initial?.trafficSearch,
    trafficSuggested: initial?.trafficSuggested,
    trafficExternal: initial?.trafficExternal,
    tags: initial?.tags ?? [],
    notes: initial?.notes ?? '',
  }));
  const [tagInput, setTagInput] = useState('');

  function setNum(key: keyof ViralExtras, raw: string) {
    setForm((f) => ({
      ...f,
      [key]: raw === '' ? undefined : Number(raw),
    }));
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    setForm((f) => ({ ...f, tags: Array.from(new Set([...(f.tags ?? []), t])) }));
    setTagInput('');
  }

  function removeTag(t: string) {
    setForm((f) => ({ ...f, tags: (f.tags ?? []).filter((x) => x !== t) }));
  }

  return (
    <div className="manual-row manual-row--editing">
      <img src={thumbnailUrl} alt="" className="manual-thumb" />
      <div className="manual-body">
        <div className="manual-title">{title}</div>
        <div className="manual-form-grid">
          <NumField label="24h 視聴" value={form.views24h} onChange={(v) => setNum('views24h', v)} />
          <NumField label="48h 視聴" value={form.views48h} onChange={(v) => setNum('views48h', v)} />
          <NumField label="72h 視聴" value={form.views72h} onChange={(v) => setNum('views72h', v)} />
          <NumField label="7日 視聴" value={form.views7d} onChange={(v) => setNum('views7d', v)} />
          <NumField label="登録獲得 (人)" value={form.subscribersGained} onChange={(v) => setNum('subscribersGained', v)} />
          <NumField label="平均視聴維持率 (%)" value={form.audienceRetentionPct} onChange={(v) => setNum('audienceRetentionPct', v)} max={100} />
          <NumField label="ブラウジング (%)" value={form.trafficBrowse} onChange={(v) => setNum('trafficBrowse', v)} max={100} />
          <NumField label="YouTube検索 (%)" value={form.trafficSearch} onChange={(v) => setNum('trafficSearch', v)} max={100} />
          <NumField label="関連動画 (%)" value={form.trafficSuggested} onChange={(v) => setNum('trafficSuggested', v)} max={100} />
          <NumField label="外部 (%)" value={form.trafficExternal} onChange={(v) => setNum('trafficExternal', v)} max={100} />
        </div>
        <div className="manual-tag-editor">
          <label className="manual-form-label">タグ（伸び要因のラベリング）</label>
          <div className="manual-tag-input">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="例: コラボ / トレンド便乗 / 新シリーズ"
            />
            <button type="button" className="btn btn-secondary" onClick={addTag}>追加</button>
          </div>
          {(form.tags ?? []).length > 0 && (
            <div className="manual-tags">
              {(form.tags ?? []).map((t) => (
                <button key={t} type="button" className="pill pill--removable" onClick={() => removeTag(t)}>
                  {t} <IconX size={11} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="manual-notes-editor">
          <label className="manual-form-label">メモ</label>
          <textarea
            rows={2}
            value={form.notes ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="例: トレンドに乗ってサムネ赤背景で初速◎ / 関連動画から流入"
          />
        </div>
      </div>
      <div className="manual-actions">
        <button className="btn btn-primary" onClick={() => onSave(form)}>
          <Save size={14} /> 保存
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

function NumField({
  label, value, onChange, max,
}: {
  label: string;
  value?: number;
  onChange: (raw: string) => void;
  max?: number;
}) {
  return (
    <label className="manual-num-field">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        step="any"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
