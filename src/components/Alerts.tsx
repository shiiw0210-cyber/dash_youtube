import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Settings as SettingsIcon } from 'lucide-react';
import { detectThumbnailAlerts, DEFAULT_ALERT_CONFIG, type AlertConfig } from '../utils/alertRules';
import { formatNumber } from '../utils/formatters';
import type { VideoStats } from '../types';

interface Props {
  videos: VideoStats[];
}

const STORAGE_KEY = 'yt_dash_alert_config';

function loadConfig(): AlertConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_ALERT_CONFIG, ...JSON.parse(raw) };
  } catch { /* empty */ }
  return DEFAULT_ALERT_CONFIG;
}

function saveConfig(c: AlertConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

export function Alerts({ videos }: Props) {
  const [config, setConfig] = useState<AlertConfig>(() => loadConfig());
  const [showSettings, setShowSettings] = useState(false);

  const alerts = useMemo(() => detectThumbnailAlerts(videos, config), [videos, config]);

  if (videos.length === 0) {
    return (
      <div className="view-container">
        <h2 className="view-title">サムネイルアラート</h2>
        <div className="empty-state">
          <p>動画データが必要です。設定から API キーとチャンネル ID を入力してください。</p>
        </div>
      </div>
    );
  }

  const updateConfig = (patch: Partial<AlertConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveConfig(next);
  };

  return (
    <div className="view-container">
      <div className="title-row">
        <h2 className="view-title" style={{ marginBottom: 0 }}>サムネイルアラート</h2>
        <button className="btn btn-secondary" onClick={() => setShowSettings((s) => !s)}>
          <SettingsIcon size={14} /> 閾値設定
        </button>
      </div>

      {showSettings && (
        <div className="alert-settings-card">
          <h3 className="section-title" style={{ marginBottom: 12 }}>アラート条件</h3>
          <div className="form-group">
            <label className="form-label">評価対象の経過時間（時間）</label>
            <input
              type="number"
              className="form-input"
              value={config.windowHours}
              min={1}
              max={168}
              onChange={(e) => updateConfig({ windowHours: parseInt(e.target.value) || 24 })}
            />
            <p className="form-hint">投稿後この時間以内の動画を評価対象にします（デフォルト24時間）。</p>
          </div>
          <div className="form-group">
            <label className="form-label">固定閾値（再生数、省略可）</label>
            <input
              type="number"
              className="form-input"
              placeholder="例：500"
              value={config.minViewsOverride ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                updateConfig({ minViewsOverride: v === '' ? undefined : parseInt(v) });
              }}
            />
            <p className="form-hint">
              指定すると、この再生数を下回ればアラート。空欄ならチャンネル平均から自動計算します。
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">自動計算時の判定割合（0〜1）</label>
            <input
              type="number"
              className="form-input"
              step="0.1"
              min={0.1}
              max={1}
              value={config.underperformRatio}
              onChange={(e) => updateConfig({ underperformRatio: parseFloat(e.target.value) || 0.5 })}
            />
            <p className="form-hint">期待値の何割を下回ったらアラートにするか（0.5 = 半分以下）。</p>
          </div>
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="alert-empty">
          <strong>✓ アラート対象なし</strong>
          <p>投稿後 {config.windowHours} 時間以内の動画はすべて目安を超えています。</p>
        </div>
      ) : (
        <>
          <div className="info-banner" style={{ background: '#fef3c7', borderColor: '#fcd34d', color: '#92400e' }}>
            <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            <strong>{alerts.length} 本</strong> の動画がパフォーマンス不足です。サムネイル・タイトルの差し替えを検討してください。
          </div>
          <div className="alert-list">
            {alerts.map((a) => (
              <div key={a.video.videoId} className={`alert-item alert-${a.severity}`}>
                {a.video.thumbnailUrl && (
                  <img src={a.video.thumbnailUrl} alt="" className="alert-thumb" />
                )}
                <div className="alert-body">
                  <h4 className="alert-title">{a.video.title}</h4>
                  <p className="alert-message">{a.message}</p>
                  <div className="alert-meta">
                    <span>現在: <strong>{formatNumber(a.currentViews)}</strong> 回</span>
                    <span>目安: <strong>{formatNumber(a.threshold)}</strong> 回</span>
                    <span>経過: <strong>{Math.floor(a.hoursAgo)}</strong> 時間</span>
                  </div>
                </div>
                <a
                  href={`https://studio.youtube.com/video/${a.video.videoId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary alert-action"
                >
                  <ExternalLink size={14} /> Studio で編集
                </a>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
