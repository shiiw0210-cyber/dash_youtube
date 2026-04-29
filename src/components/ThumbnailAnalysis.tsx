import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Image as ImageIcon, Layers, Type, Palette, Pencil, Save, X as IconX, ListChecks,
} from 'lucide-react';
import {
  GENRE_PRESETS, COLOR_LABEL, COLOR_HEX, EXPRESSION_LABEL, FACE_LABEL,
  groupByGenre, analyzeThumbnailWords, groupByField, computeCoverage,
  type BucketStat,
} from '../utils/thumbnailAnalysis';
import { formatNumber, formatDate } from '../utils/formatters';
import type {
  VideoStats, ThumbnailMeta, ThumbnailColor, ThumbnailExpression,
} from '../types';

interface Props {
  videos: VideoStats[];
  metaMap: Record<string, ThumbnailMeta>;
  onUpdateMeta: (videoId: string, patch: Partial<ThumbnailMeta>) => void;
  onClearMeta: (videoId: string) => void;
}

type Tab = 'top' | 'genre' | 'words' | 'attrs' | 'manual';

export function ThumbnailAnalysis({ videos, metaMap, onUpdateMeta, onClearMeta }: Props) {
  const [tab, setTab] = useState<Tab>('top');

  if (videos.length === 0) {
    return (
      <div className="view-container">
        <h2 className="view-title">サムネ分析</h2>
        <div className="empty-state">
          <p>動画データが必要です。設定から API キーとチャンネル ID を入力してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <h2 className="view-title">サムネ分析</h2>

      <div className="tab-group">
        <button className={`tab ${tab === 'top' ? 'tab--active' : ''}`} onClick={() => setTab('top')}>
          <ImageIcon size={14} /> 伸びサムネ TOP
        </button>
        <button className={`tab ${tab === 'genre' ? 'tab--active' : ''}`} onClick={() => setTab('genre')}>
          <Layers size={14} /> ジャンル別
        </button>
        <button className={`tab ${tab === 'words' ? 'tab--active' : ''}`} onClick={() => setTab('words')}>
          <Type size={14} /> サムネワード
        </button>
        <button className={`tab ${tab === 'attrs' ? 'tab--active' : ''}`} onClick={() => setTab('attrs')}>
          <Palette size={14} /> 色・表情・人物
        </button>
        <button className={`tab ${tab === 'manual' ? 'tab--active' : ''}`} onClick={() => setTab('manual')}>
          <Pencil size={14} /> 手入力
        </button>
      </div>

      {tab === 'top' && <TopTab videos={videos} metaMap={metaMap} />}
      {tab === 'genre' && <GenreTab videos={videos} metaMap={metaMap} />}
      {tab === 'words' && <WordsTab videos={videos} metaMap={metaMap} />}
      {tab === 'attrs' && <AttrsTab videos={videos} metaMap={metaMap} />}
      {tab === 'manual' && (
        <ManualTab
          videos={videos}
          metaMap={metaMap}
          onUpdateMeta={onUpdateMeta}
          onClearMeta={onClearMeta}
        />
      )}
    </div>
  );
}

/* ====================== Top Tab ====================== */

function TopTab({ videos, metaMap }: { videos: VideoStats[]; metaMap: Record<string, ThumbnailMeta> }) {
  const sorted = useMemo(
    () => [...videos].sort((a, b) => b.viewCount - a.viewCount).slice(0, 24),
    [videos]
  );

  const channelAvg =
    videos.length > 0 ? videos.reduce((s, v) => s + v.viewCount, 0) / videos.length : 0;

  return (
    <>
      <div className="info-banner">
        再生数 TOP のサムネをギャラリー表示します。手入力したジャンル・サムネ文字も表示するので、
        伸びている動画に共通する「型」を見つけてください。
      </div>
      <div className="thumb-gallery">
        {sorted.map((v, i) => {
          const meta = metaMap[v.videoId];
          const ratio = channelAvg > 0 ? v.viewCount / channelAvg : 0;
          return (
            <a
              key={v.videoId}
              className="thumb-card"
              href={`https://www.youtube.com/watch?v=${v.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="thumb-rank">#{i + 1}</div>
              <img src={v.thumbnailUrl} alt={v.title} className="thumb-card-img" />
              <div className="thumb-card-body">
                <div className="thumb-card-title">{v.title}</div>
                <div className="thumb-card-stats">
                  <strong>{formatNumber(v.viewCount)}</strong>
                  <span style={{ color: ratio >= 1 ? '#16a34a' : '#dc2626' }}>
                    平均×{ratio.toFixed(2)}
                  </span>
                  <span className="thumb-card-date">{formatDate(v.publishedAt)}</span>
                </div>
                {meta?.genres && meta.genres.length > 0 && (
                  <div className="thumb-tag-row">
                    {meta.genres.slice(0, 4).map((g) => (
                      <span key={g} className="pill">{g}</span>
                    ))}
                  </div>
                )}
                {meta?.thumbnailText && (
                  <div className="thumb-text-quote">
                    <Type size={11} /> {meta.thumbnailText}
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </>
  );
}

/* ====================== Genre Tab ====================== */

function GenreTab({ videos, metaMap }: { videos: VideoStats[]; metaMap: Record<string, ThumbnailMeta> }) {
  const buckets = useMemo(() => groupByGenre(videos, metaMap), [videos, metaMap]);
  const channelAvg =
    videos.length > 0 ? videos.reduce((s, v) => s + v.viewCount, 0) / videos.length : 0;

  if (buckets.length === 0) {
    return (
      <EmptyHelper
        text="ジャンルが設定された動画がまだありません。「手入力」タブから動画ごとにジャンルを登録してください。"
      />
    );
  }

  return (
    <>
      <div className="info-banner">
        サムネのジャンル (型) ごとに <strong>平均再生数</strong> を比較します。チャンネル平均
        ({formatNumber(Math.round(channelAvg))}) を超えるジャンルは <span style={{ color: '#16a34a' }}>緑</span>、
        下回るジャンルは <span style={{ color: '#dc2626' }}>赤</span> で表示されます。
      </div>
      <BucketChart buckets={buckets} channelAvg={channelAvg} />
      <BucketTable buckets={buckets} channelAvg={channelAvg} headerLabel="ジャンル" />
    </>
  );
}

/* ====================== Words Tab ====================== */

function WordsTab({ videos, metaMap }: { videos: VideoStats[]; metaMap: Record<string, ThumbnailMeta> }) {
  const words = useMemo(() => analyzeThumbnailWords(videos, metaMap, 2).slice(0, 30), [videos, metaMap]);
  const channelAvg =
    videos.length > 0 ? videos.reduce((s, v) => s + v.viewCount, 0) / videos.length : 0;

  if (words.length === 0) {
    return (
      <EmptyHelper
        text="サムネ上の文字が複数の動画に共通していません。「手入力」タブで動画ごとにサムネ上の文字を入力してください (例: 衝撃、暴露、第3位)。"
      />
    );
  }

  const chartData = words.slice(0, 15).map((w) => ({
    name: w.word,
    avgViews: Math.round(w.avgViews),
    count: w.count,
    aboveAvg: w.avgViews >= channelAvg,
  }));

  return (
    <>
      <div className="info-banner">
        手入力された<strong>サムネ上の文字</strong>を 2 本以上の動画から抽出し、
        その語を含む動画の平均再生数で並べています。チャンネル平均
        ({formatNumber(Math.round(channelAvg))}) 比で色分け。
      </div>

      <div className="chart-section">
        <h3 className="section-title">サムネワード × 平均再生数 TOP 15</h3>
        <ResponsiveContainer width="100%" height={Math.max(360, chartData.length * 28)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
            <Tooltip
              formatter={(value, _name, entry) => {
                const count = (entry?.payload as { count?: number } | undefined)?.count ?? 0;
                return [`${formatNumber(value as number)} 回 (${count} 本)`, '平均再生数'];
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
              <th>サムネワード</th>
              <th className="num-cell">出現本数</th>
              <th className="num-cell">平均再生数</th>
              <th className="num-cell">VS チャンネル平均</th>
            </tr>
          </thead>
          <tbody>
            {words.map((w) => {
              const ratio = channelAvg > 0 ? w.avgViews / channelAvg : 0;
              return (
                <tr key={w.word}>
                  <td><strong>{w.word}</strong></td>
                  <td className="num-cell">{w.count}</td>
                  <td className="num-cell">{formatNumber(Math.round(w.avgViews))}</td>
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

/* ====================== Attributes Tab ====================== */

function AttrsTab({ videos, metaMap }: { videos: VideoStats[]; metaMap: Record<string, ThumbnailMeta> }) {
  const channelAvg =
    videos.length > 0 ? videos.reduce((s, v) => s + v.viewCount, 0) / videos.length : 0;

  const colorBuckets = useMemo(
    () => groupByField(videos, metaMap, 'bgColor', (v) => COLOR_LABEL[v as ThumbnailColor]),
    [videos, metaMap]
  );
  const expressionBuckets = useMemo(
    () => groupByField(videos, metaMap, 'expression', (v) => EXPRESSION_LABEL[v as ThumbnailExpression]),
    [videos, metaMap]
  );
  const faceBuckets = useMemo(
    () => groupByField(videos, metaMap, 'faceClose', (v) => FACE_LABEL[v as 'none' | 'partial' | 'closeup']),
    [videos, metaMap]
  );
  const personBuckets = useMemo(
    () => groupByField(videos, metaMap, 'personCount', (v) => v === 5 ? '5人以上' : v === 0 ? '0 (人物なし)' : `${v}人`),
    [videos, metaMap]
  );
  const numberBuckets = useMemo(
    () => groupByField(videos, metaMap, 'hasNumber', (v) => v ? '数字あり' : '数字なし'),
    [videos, metaMap]
  );
  const arrowBuckets = useMemo(
    () => groupByField(videos, metaMap, 'hasArrow', (v) => v ? '矢印・装飾あり' : 'なし'),
    [videos, metaMap]
  );

  const sections: { title: string; buckets: BucketStat[] }[] = [
    { title: '背景色', buckets: colorBuckets },
    { title: '表情', buckets: expressionBuckets },
    { title: '顔の写り方', buckets: faceBuckets },
    { title: '人物数', buckets: personBuckets },
    { title: '数字訴求', buckets: numberBuckets },
    { title: '矢印・装飾', buckets: arrowBuckets },
  ];

  const hasAny = sections.some((s) => s.buckets.length > 0);
  if (!hasAny) {
    return (
      <EmptyHelper
        text="色・表情・人物などの属性データがありません。「手入力」タブから登録してください。"
      />
    );
  }

  return (
    <>
      <div className="info-banner">
        サムネの属性別に平均再生数を比較します。本数が偏っている場合は参考値として扱ってください。
      </div>
      <div className="attr-grid">
        {sections.map((s) => (
          s.buckets.length > 0 && (
            <div key={s.title} className="attr-card">
              <h3 className="section-title">{s.title}</h3>
              <BucketTable buckets={s.buckets} channelAvg={channelAvg} headerLabel={s.title} compact />
            </div>
          )
        ))}
      </div>
    </>
  );
}

/* ====================== Manual Input Tab ====================== */

function ManualTab({
  videos,
  metaMap,
  onUpdateMeta,
  onClearMeta,
}: {
  videos: VideoStats[];
  metaMap: Record<string, ThumbnailMeta>;
  onUpdateMeta: (id: string, patch: Partial<ThumbnailMeta>) => void;
  onClearMeta: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'filled' | 'missing'>('all');

  const sorted = useMemo(
    () => [...videos].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    ),
    [videos]
  );

  const filtered = useMemo(() => {
    if (filter === 'filled') return sorted.filter((v) => metaMap[v.videoId]);
    if (filter === 'missing') return sorted.filter((v) => !metaMap[v.videoId]);
    return sorted;
  }, [sorted, filter, metaMap]);

  const coverage = computeCoverage(videos, metaMap);

  return (
    <>
      <div className="info-banner">
        動画ごとにサムネのジャンル・サムネ上の文字・色・表情・人物などを入力します。
        入力するほど分析の精度が上がり、ジャンル別／サムネワード別の集計に反映されます。
        データはブラウザの localStorage に保存されます。
      </div>
      <div className="manual-toolbar">
        <span>
          入力済み: <strong>{coverage.filled}</strong> / {coverage.total} 本
          {' · '}
          ジャンル: <strong>{coverage.withGenre}</strong>
          {' · '}
          サムネ文字: <strong>{coverage.withText}</strong>
        </span>
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
        {filtered.map((v) => (
          <ThumbRow
            key={v.videoId}
            video={v}
            meta={metaMap[v.videoId]}
            editing={editing === v.videoId}
            onEdit={() => setEditing(v.videoId)}
            onCancel={() => setEditing(null)}
            onSave={(patch) => {
              onUpdateMeta(v.videoId, patch);
              setEditing(null);
            }}
            onClear={() => onClearMeta(v.videoId)}
          />
        ))}
      </div>
    </>
  );
}

function ThumbRow({
  video,
  meta,
  editing,
  onEdit,
  onCancel,
  onSave,
  onClear,
}: {
  video: VideoStats;
  meta?: ThumbnailMeta;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<ThumbnailMeta>) => void;
  onClear: () => void;
}) {
  if (!editing) {
    return (
      <div className="manual-row">
        <img src={video.thumbnailUrl} alt="" className="manual-thumb" />
        <div className="manual-body">
          <div className="manual-title">
            <a href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer">
              {video.title}
            </a>
          </div>
          <div className="manual-meta">
            {formatDate(video.publishedAt)} · {formatNumber(video.viewCount)} 回
          </div>
          {meta?.genres && meta.genres.length > 0 && (
            <div className="manual-tags">
              {meta.genres.map((g) => <span key={g} className="pill">{g}</span>)}
            </div>
          )}
          <div className="manual-extras">
            {meta?.thumbnailText && (
              <span className="manual-field">
                <span className="manual-field-label">文字</span>
                <span className="manual-field-value">{meta.thumbnailText}</span>
              </span>
            )}
            {meta?.bgColor && (
              <span className="manual-field">
                <span className="manual-field-label">背景</span>
                <span className="thumb-color-chip" style={{ background: COLOR_HEX[meta.bgColor], color: ['white','yellow','gray'].includes(meta.bgColor) ? '#111' : '#fff' }}>
                  {COLOR_LABEL[meta.bgColor]}
                </span>
              </span>
            )}
            {meta?.expression && (
              <span className="manual-field">
                <span className="manual-field-label">表情</span>
                <span className="manual-field-value">{EXPRESSION_LABEL[meta.expression]}</span>
              </span>
            )}
            {meta?.faceClose && (
              <span className="manual-field">
                <span className="manual-field-label">顔</span>
                <span className="manual-field-value">{FACE_LABEL[meta.faceClose]}</span>
              </span>
            )}
            {meta?.personCount != null && (
              <span className="manual-field">
                <span className="manual-field-label">人物</span>
                <span className="manual-field-value">{meta.personCount === 5 ? '5+' : meta.personCount}人</span>
              </span>
            )}
            {meta?.hasNumber && <span className="pill">数字あり</span>}
            {meta?.hasArrow && <span className="pill">矢印・装飾</span>}
          </div>
          {meta?.notes && <div className="manual-notes">{meta.notes}</div>}
        </div>
        <div className="manual-actions">
          <button className="btn btn-secondary" onClick={onEdit}>
            <Pencil size={14} /> 編集
          </button>
          {meta && (
            <button className="icon-btn icon-btn--danger" onClick={onClear} title="削除" aria-label="削除">
              <IconX size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <ThumbEditForm
      video={video}
      initial={meta}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
}

function ThumbEditForm({
  video,
  initial,
  onCancel,
  onSave,
}: {
  video: VideoStats;
  initial?: ThumbnailMeta;
  onCancel: () => void;
  onSave: (patch: Partial<ThumbnailMeta>) => void;
}) {
  const [form, setForm] = useState<Partial<ThumbnailMeta>>(() => ({
    genres: initial?.genres ?? [],
    thumbnailText: initial?.thumbnailText ?? '',
    bgColor: initial?.bgColor,
    textColor: initial?.textColor,
    personCount: initial?.personCount,
    faceClose: initial?.faceClose,
    expression: initial?.expression,
    hasNumber: initial?.hasNumber,
    hasArrow: initial?.hasArrow,
    notes: initial?.notes ?? '',
  }));
  const [genreInput, setGenreInput] = useState('');

  function toggleGenre(g: string) {
    setForm((f) => {
      const cur = new Set(f.genres ?? []);
      if (cur.has(g)) cur.delete(g);
      else cur.add(g);
      return { ...f, genres: Array.from(cur) };
    });
  }

  function addCustomGenre() {
    const g = genreInput.trim();
    if (!g) return;
    setForm((f) => ({ ...f, genres: Array.from(new Set([...(f.genres ?? []), g])) }));
    setGenreInput('');
  }

  return (
    <div className="manual-row manual-row--editing">
      <img src={video.thumbnailUrl} alt="" className="manual-thumb" />
      <div className="manual-body">
        <div className="manual-title">{video.title}</div>

        <div className="thumb-field">
          <label className="manual-form-label">ジャンル (複数選択可)</label>
          <div className="thumb-genre-grid">
            {GENRE_PRESETS.map((g) => {
              const on = (form.genres ?? []).includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  className={`pill pill--toggle${on ? ' pill--on' : ''}`}
                  onClick={() => toggleGenre(g)}
                >
                  {g}
                </button>
              );
            })}
          </div>
          <div className="thumb-custom-genre">
            <input
              type="text"
              value={genreInput}
              onChange={(e) => setGenreInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomGenre(); } }}
              placeholder="カスタムジャンルを追加"
            />
            <button type="button" className="btn btn-secondary" onClick={addCustomGenre}>追加</button>
          </div>
          {(form.genres ?? []).filter((g) => !GENRE_PRESETS.includes(g)).length > 0 && (
            <div className="manual-tags">
              {(form.genres ?? []).filter((g) => !GENRE_PRESETS.includes(g)).map((g) => (
                <button
                  key={g}
                  type="button"
                  className="pill pill--removable"
                  onClick={() => toggleGenre(g)}
                >
                  {g} <IconX size={11} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="thumb-field">
          <label className="manual-form-label">サムネ上の文字 (区切り: 空白 / 読点 / カンマ)</label>
          <input
            type="text"
            className="thumb-text-input"
            value={form.thumbnailText ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, thumbnailText: e.target.value }))}
            placeholder="例: 衝撃 暴露 第3位 ¥10万"
          />
        </div>

        <div className="thumb-field-row">
          <div className="thumb-field">
            <label className="manual-form-label">背景色</label>
            <ColorPicker
              value={form.bgColor}
              onChange={(c) => setForm((f) => ({ ...f, bgColor: c }))}
            />
          </div>
          <div className="thumb-field">
            <label className="manual-form-label">文字色</label>
            <ColorPicker
              value={form.textColor}
              onChange={(c) => setForm((f) => ({ ...f, textColor: c }))}
            />
          </div>
        </div>

        <div className="thumb-field-row">
          <div className="thumb-field">
            <label className="manual-form-label">表情</label>
            <SelectField
              value={form.expression}
              options={Object.entries(EXPRESSION_LABEL).map(([k, v]) => ({ value: k, label: v }))}
              onChange={(v) => setForm((f) => ({ ...f, expression: v as ThumbnailExpression | undefined }))}
            />
          </div>
          <div className="thumb-field">
            <label className="manual-form-label">顔の写り方</label>
            <SelectField
              value={form.faceClose}
              options={Object.entries(FACE_LABEL).map(([k, v]) => ({ value: k, label: v }))}
              onChange={(v) => setForm((f) => ({ ...f, faceClose: v as 'none' | 'partial' | 'closeup' | undefined }))}
            />
          </div>
          <div className="thumb-field">
            <label className="manual-form-label">人物数</label>
            <SelectField
              value={form.personCount != null ? String(form.personCount) : undefined}
              options={[
                { value: '0', label: '0 (人物なし)' },
                { value: '1', label: '1人' },
                { value: '2', label: '2人' },
                { value: '3', label: '3人' },
                { value: '4', label: '4人' },
                { value: '5', label: '5人以上' },
              ]}
              onChange={(v) => setForm((f) => ({ ...f, personCount: v != null ? Number(v) as ThumbnailMeta['personCount'] : undefined }))}
            />
          </div>
        </div>

        <div className="thumb-field-row">
          <label className="thumb-checkbox">
            <input
              type="checkbox"
              checked={!!form.hasNumber}
              onChange={(e) => setForm((f) => ({ ...f, hasNumber: e.target.checked }))}
            />
            数字を強調表示
          </label>
          <label className="thumb-checkbox">
            <input
              type="checkbox"
              checked={!!form.hasArrow}
              onChange={(e) => setForm((f) => ({ ...f, hasArrow: e.target.checked }))}
            />
            矢印・装飾枠あり
          </label>
        </div>

        <div className="manual-notes-editor">
          <label className="manual-form-label">メモ</label>
          <textarea
            rows={2}
            value={form.notes ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="例: 反応リアクション系で初動◎ / 矢印で誘導"
          />
        </div>
      </div>
      <div className="manual-actions">
        <button className="btn btn-primary" onClick={() => onSave(form)}>
          <Save size={14} /> 保存
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>キャンセル</button>
      </div>
    </div>
  );
}

/* ====================== Reusable bits ====================== */

function BucketChart({ buckets, channelAvg }: { buckets: BucketStat[]; channelAvg: number }) {
  const data = buckets.map((b) => ({
    name: b.label,
    avgViews: Math.round(b.avgViews),
    count: b.count,
    aboveAvg: b.avgViews >= channelAvg,
  }));
  return (
    <div className="chart-section">
      <h3 className="section-title">平均再生数</h3>
      <ResponsiveContainer width="100%" height={Math.max(280, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={130} />
          <Tooltip
            formatter={(value, _name, entry) => {
              const count = (entry?.payload as { count?: number } | undefined)?.count ?? 0;
              return [`${formatNumber(value as number)} 回 (${count} 本)`, '平均再生数'];
            }}
          />
          <Bar dataKey="avgViews" radius={[0, 4, 4, 0]}>
            {data.map((e, i) => (
              <Cell key={i} fill={e.aboveAvg ? '#16a34a' : '#dc2626'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BucketTable({
  buckets, channelAvg, headerLabel, compact,
}: {
  buckets: BucketStat[];
  channelAvg: number;
  headerLabel: string;
  compact?: boolean;
}) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>{headerLabel}</th>
            <th className="num-cell">本数</th>
            <th className="num-cell">平均再生</th>
            {!compact && <th className="num-cell">いいね率</th>}
            <th className="num-cell">VS 平均</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => {
            const ratio = channelAvg > 0 ? b.avgViews / channelAvg : 0;
            return (
              <tr key={b.key}>
                <td><strong>{b.label}</strong></td>
                <td className="num-cell">{b.count}</td>
                <td className="num-cell">{formatNumber(Math.round(b.avgViews))}</td>
                {!compact && <td className="num-cell">{(b.avgLikeRate * 100).toFixed(2)}%</td>}
                <td className="num-cell" style={{ color: ratio >= 1 ? '#16a34a' : '#dc2626' }}>
                  {ratio >= 1 ? '+' : ''}{((ratio - 1) * 100).toFixed(0)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ColorPicker({
  value, onChange,
}: {
  value: ThumbnailColor | undefined;
  onChange: (c: ThumbnailColor | undefined) => void;
}) {
  const colors: ThumbnailColor[] = [
    'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink',
    'black', 'white', 'gray', 'gradient', 'other',
  ];
  return (
    <div className="thumb-color-picker">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={`thumb-color-swatch${value === c ? ' thumb-color-swatch--on' : ''}`}
          onClick={() => onChange(value === c ? undefined : c)}
          title={COLOR_LABEL[c]}
          style={{ background: COLOR_HEX[c] }}
          aria-label={COLOR_LABEL[c]}
        />
      ))}
    </div>
  );
}

function SelectField<T extends string>({
  value, options, onChange,
}: {
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T | undefined) => void;
}) {
  return (
    <select
      className="thumb-select"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value as T)}
    >
      <option value="">— 未指定 —</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function EmptyHelper({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <p>{text}</p>
    </div>
  );
}
