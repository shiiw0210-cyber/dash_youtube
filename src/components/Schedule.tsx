import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useScheduleApi, type ScheduleDraft } from '../hooks/useScheduleApi';
import { formatNumber } from '../utils/formatters';
import type { ScheduleRow, VideoStats } from '../types';

interface Props {
  videos: VideoStats[];
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const EMPTY_DRAFT: ScheduleDraft = {
  shoot: '',
  shootDate: '',
  deliveryDate: '',
  publishDate: '',
  editor: '',
  thumbnail: '',
  title: '',
  content: '',
  materialUrl: '',
};

const EDITOR_ALL = '__ALL__';
const DEBOUNCE_MS = 800;

function normalizeTitle(s: string): string {
  return s.trim().replace(/[\s　]+/g, '').toLowerCase();
}

function matchVideo(row: ScheduleRow, videos: VideoStats[]): VideoStats | undefined {
  if (!row.title) return undefined;
  const key = normalizeTitle(row.title);
  if (key.length < 4) return undefined;
  return videos.find((v) => {
    const t = normalizeTitle(v.title);
    return t.includes(key.slice(0, Math.min(20, key.length))) || key.includes(t.slice(0, 20));
  });
}

function publishDateKey(row: ScheduleRow): number {
  const d = Date.parse(row.publishDate);
  return Number.isFinite(d) ? d : Number.POSITIVE_INFINITY;
}

export function Schedule({ videos }: Props) {
  const { fetchSchedule, addRow, saveRow, deleteRow, loading, error } = useScheduleApi();
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [editorFilter, setEditorFilter] = useState<string>(EDITOR_ALL);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    void reload();
    return () => {
      Object.values(debounceTimers.current).forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reload() {
    const list = await fetchSchedule();
    setRows(list);
  }

  function setSaveState(id: string, state: SaveState) {
    setSaveStates((prev) => ({ ...prev, [id]: state }));
    if (state === 'saved') {
      setTimeout(() => {
        setSaveStates((prev) => {
          if (prev[id] !== 'saved') return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 1500);
    }
  }

  function scheduleSave(row: ScheduleRow) {
    if (!row.id) return;
    const prev = debounceTimers.current[row.id];
    if (prev) clearTimeout(prev);
    debounceTimers.current[row.id] = setTimeout(() => {
      void persist(row);
    }, DEBOUNCE_MS);
  }

  async function persist(row: ScheduleRow) {
    setSaveState(row.id, 'saving');
    const saved = await saveRow(row);
    if (saved) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...saved } : r)));
      setSaveState(row.id, 'saved');
    } else {
      setSaveState(row.id, 'error');
    }
  }

  function updateField<K extends keyof ScheduleRow>(id: string, field: K, value: ScheduleRow[K]) {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, [field]: value } : r));
      const changed = next.find((r) => r.id === id);
      if (changed) scheduleSave(changed);
      return next;
    });
  }

  async function handleAdd() {
    const created = await addRow(EMPTY_DRAFT);
    if (created) {
      setRows((prev) => [created, ...prev]);
      setExpanded((prev) => ({ ...prev, [created.id]: true }));
    }
  }

  async function handleDelete(row: ScheduleRow) {
    if (!row.id) return;
    if (!window.confirm(`この行を削除しますか？\n${row.title || '(無題)'}`)) return;
    const ok = await deleteRow(row.id);
    if (ok) {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    }
  }

  const editors = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.editor) set.add(r.editor);
    });
    return Array.from(set).sort();
  }, [rows]);

  const visibleRows = useMemo(() => {
    const filtered = editorFilter === EDITOR_ALL
      ? rows
      : rows.filter((r) => r.editor === editorFilter);
    return [...filtered].sort((a, b) => publishDateKey(a) - publishDateKey(b));
  }, [rows, editorFilter]);

  return (
    <div className="view-container">
      <h2 className="view-title">投稿スケジュール</h2>

      <div className="schedule-toolbar">
        <button className="btn btn-primary" onClick={handleAdd} disabled={loading}>
          <Plus size={16} />
          <span>追加</span>
        </button>
        <button className="btn" onClick={() => void reload()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>再読み込み</span>
        </button>
        <label className="schedule-filter">
          <span>編集担当者:</span>
          <select value={editorFilter} onChange={(e) => setEditorFilter(e.target.value)}>
            <option value={EDITOR_ALL}>全員</option>
            {editors.map((ed) => (
              <option key={ed} value={ed}>{ed}</option>
            ))}
          </select>
        </label>
        {error && <span className="schedule-error">{error}</span>}
      </div>

      {rows.length === 0 && !loading && (
        <div className="empty-state">
          <p>スケジュール行がありません。「追加」から作成してください。</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="table-wrapper">
          <table className="data-table schedule-table">
            <thead>
              <tr>
                <th aria-label="展開" className="col-expand"></th>
                <th>撮影</th>
                <th>撮影予定日</th>
                <th>納品日</th>
                <th>配信日</th>
                <th>編集担当者</th>
                <th>タイトル</th>
                <th>素材</th>
                <th>再生数</th>
                <th>状態</th>
                <th aria-label="操作" className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const matched = matchVideo(row, videos);
                const isExpanded = !!expanded[row.id];
                const saveState = saveStates[row.id] ?? 'idle';
                return (
                  <Fragment key={row.id}>
                    <tr className={row.todo ? 'row-todo' : undefined}>
                      <td className="col-expand">
                        <button
                          className="icon-btn"
                          onClick={() => setExpanded((p) => ({ ...p, [row.id]: !p[row.id] }))}
                          aria-label={isExpanded ? '閉じる' : '開く'}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td>
                        <input
                          className="schedule-input"
                          value={row.shoot}
                          onChange={(e) => updateField(row.id, 'shoot', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="schedule-input schedule-input--date"
                          value={row.shootDate}
                          onChange={(e) => updateField(row.id, 'shootDate', e.target.value)}
                          placeholder="4/16"
                        />
                      </td>
                      <td>
                        <input
                          className="schedule-input schedule-input--date"
                          value={row.deliveryDate}
                          onChange={(e) => updateField(row.id, 'deliveryDate', e.target.value)}
                          placeholder="5/1"
                        />
                      </td>
                      <td>
                        <input
                          className="schedule-input schedule-input--date"
                          value={row.publishDate}
                          onChange={(e) => updateField(row.id, 'publishDate', e.target.value)}
                          placeholder="5/2"
                        />
                      </td>
                      <td>
                        <input
                          className="schedule-input"
                          value={row.editor}
                          onChange={(e) => updateField(row.id, 'editor', e.target.value)}
                        />
                      </td>
                      <td className="schedule-title-cell">
                        <input
                          className="schedule-input"
                          value={row.title}
                          onChange={(e) => updateField(row.id, 'title', e.target.value)}
                        />
                      </td>
                      <td>
                        {row.materialUrl && /^https?:\/\//.test(row.materialUrl) ? (
                          <a
                            href={row.materialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ext-link"
                            title="素材を開く"
                          >
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="num-cell">
                        {matched ? formatNumber(matched.viewCount) : '—'}
                      </td>
                      <td>
                        {row.todo && <span className="schedule-todo-badge">要対応</span>}
                        {saveState === 'saving' && <span className="schedule-save-pill schedule-save-pill--saving">保存中…</span>}
                        {saveState === 'saved' && <span className="schedule-save-pill schedule-save-pill--saved">保存済</span>}
                        {saveState === 'error' && <span className="schedule-save-pill schedule-save-pill--error">エラー</span>}
                      </td>
                      <td className="col-actions">
                        <button
                          className="icon-btn icon-btn--danger"
                          onClick={() => void handleDelete(row)}
                          aria-label="削除"
                          title="削除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="schedule-expand-row">
                        <td></td>
                        <td colSpan={10}>
                          <div className="schedule-expand-grid">
                            <label className="schedule-field">
                              <span>サムネ内容</span>
                              <textarea
                                value={row.thumbnail}
                                onChange={(e) => updateField(row.id, 'thumbnail', e.target.value)}
                                rows={3}
                              />
                            </label>
                            <label className="schedule-field">
                              <span>内容</span>
                              <textarea
                                value={row.content}
                                onChange={(e) => updateField(row.id, 'content', e.target.value)}
                                rows={3}
                              />
                            </label>
                            <label className="schedule-field schedule-field--full">
                              <span>素材 URL</span>
                              <input
                                className="schedule-input"
                                value={row.materialUrl}
                                onChange={(e) => updateField(row.id, 'materialUrl', e.target.value)}
                                placeholder="https://..."
                              />
                            </label>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
