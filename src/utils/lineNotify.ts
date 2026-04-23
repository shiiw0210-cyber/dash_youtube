import type { ThumbnailAlert } from './alertRules';

export interface LineConfig {
  channelAccessToken: string;
  groupId: string;
}

const LINE_STORAGE_KEY = 'yt_dash_line_config';

export function loadLineConfig(): LineConfig {
  try {
    const raw = localStorage.getItem(LINE_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LineConfig;
  } catch { /* empty */ }
  return { channelAccessToken: '', groupId: '' };
}

export function saveLineConfig(config: LineConfig) {
  localStorage.setItem(LINE_STORAGE_KEY, JSON.stringify(config));
}

function buildAlertText(alerts: ThumbnailAlert[]): string {
  const lines: string[] = [
    `🔴 YouTubeサムネイルアラート（${alerts.length}件）`,
    '─────────────────',
  ];

  for (const a of alerts.slice(0, 5)) {
    const icon = a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🔵';
    lines.push(
      `${icon} ${a.video.title.slice(0, 30)}${a.video.title.length > 30 ? '…' : ''}`,
      `　${Math.floor(a.hoursAgo)}時間で ${a.currentViews.toLocaleString()}回（目安: ${a.threshold.toLocaleString()}回）`,
      `　▶ https://studio.youtube.com/video/${a.video.videoId}/edit`,
    );
  }

  if (alerts.length > 5) {
    lines.push(`…他 ${alerts.length - 5} 件`);
  }

  return lines.join('\n');
}

export async function sendLineAlerts(
  config: LineConfig,
  alerts: ThumbnailAlert[]
): Promise<{ ok: boolean; error?: string }> {
  if (!config.channelAccessToken || !config.groupId) {
    return { ok: false, error: 'LINE の設定が未完了です' };
  }
  if (alerts.length === 0) {
    return { ok: false, error: 'アラート対象の動画がありません' };
  }

  try {
    const res = await fetch('/api/line/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelAccessToken: config.channelAccessToken,
        to: config.groupId,
        messages: [{ type: 'text', text: buildAlertText(alerts) }],
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: unknown };
      return { ok: false, error: JSON.stringify(data.error ?? res.status) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function sendLineTest(
  config: LineConfig
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/line/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelAccessToken: config.channelAccessToken,
        to: config.groupId,
        messages: [{ type: 'text', text: '✅ YouTube Analytics ダッシュボードからのテスト送信です。LINE通知が正常に設定されました！' }],
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: unknown };
      return { ok: false, error: JSON.stringify(data.error ?? res.status) };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'サーバーに接続できません。npm run dev でサーバーが起動しているか確認してください。' };
  }
}
