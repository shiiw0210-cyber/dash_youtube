import express from 'express';
import cors from 'cors';
import {
  createSchedule,
  deleteSchedule,
  diagnose,
  listSchedules,
  updateSchedule,
} from '../api/_lib/scheduleStore.js';

const app = express();
const PORT = 3001;
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

app.use(express.json());
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));

/** YouTube channel proxy (local dev) */
app.get('/api/youtube/channel', async (req, res) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'YOUTUBE_API_KEY が設定されていません (.env.local を確認してください)' }); return; }
  const { channelId } = req.query;
  if (!channelId || typeof channelId !== 'string') { res.status(400).json({ error: 'channelId は必須です' }); return; }
  try {
    const r = await fetch(`${YT_BASE}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`);
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/** YouTube videos proxy (local dev) */
app.get('/api/youtube/videos', async (req, res) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'YOUTUBE_API_KEY が設定されていません (.env.local を確認してください)' }); return; }
  const { channelId, maxResults = '50' } = req.query;
  if (!channelId || typeof channelId !== 'string') { res.status(400).json({ error: 'channelId は必須です' }); return; }
  try {
    const searchRes = await fetch(`${YT_BASE}/search?part=id&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${apiKey}`);
    if (!searchRes.ok) { res.status(searchRes.status).json(await searchRes.json()); return; }
    const searchData = await searchRes.json() as { items?: { id: { videoId: string } }[] };
    const ids = searchData.items?.map((i) => i.id.videoId) ?? [];
    if (ids.length === 0) { res.json({ items: [] }); return; }
    const videoRes = await fetch(`${YT_BASE}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${apiKey}`);
    res.status(videoRes.status).json(await videoRes.json());
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/** LINE Messaging API push メッセージ送信プロキシ */
app.post('/api/line/push', async (req, res) => {
  const { channelAccessToken, to, messages } = req.body as {
    channelAccessToken: string;
    to: string;
    messages: { type: string; text: string }[];
  };

  if (!channelAccessToken || !to || !messages?.length) {
    res.status(400).json({ error: 'channelAccessToken, to, messages は必須です' });
    return;
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({ to, messages }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      res.status(response.status).json({ error: data });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/** Supabase 経由のスケジュール CRUD */
function buildErrorPayload(e: unknown): { error: string; details?: string; hint?: string } {
  const msg = e instanceof Error ? e.message : String(e);
  const payload: { error: string; details?: string; hint?: string } = { error: msg };
  if (/SUPABASE_URL \/ SUPABASE_SERVICE_ROLE_KEY/.test(msg)) {
    payload.hint = '.env.local に SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定して再起動してください';
  } else if (/relation .* does not exist/i.test(msg) || /Could not find the table/i.test(msg)) {
    payload.hint = 'Supabase の SQL Editor で supabase/schema.sql を実行してテーブルを作成してください';
  } else if (/Invalid API key/i.test(msg) || /JWT/i.test(msg)) {
    payload.hint = 'SUPABASE_SERVICE_ROLE_KEY が正しい値か確認してください';
  }
  if (e instanceof Error && e.stack) payload.details = e.stack.split('\n').slice(0, 3).join(' | ');
  return payload;
}

app.get('/api/sheets/schedule', async (req, res) => {
  try {
    if (req.query.diag === '1' || req.query.diag === 'true') {
      res.json(await diagnose());
      return;
    }
    const rows = await listSchedules();
    res.json({ rows });
  } catch (e) {
    console.error('[GET /api/sheets/schedule]', e);
    res.status(500).json(buildErrorPayload(e));
  }
});

app.post('/api/sheets/schedule', async (req, res) => {
  try {
    const body = (req.body ?? {}) as { action?: string; row?: Record<string, unknown>; id?: string };
    switch (body.action) {
      case 'create': {
        const row = await createSchedule(body.row ?? {});
        res.json({ row });
        return;
      }
      case 'update': {
        const result = await updateSchedule((body.row ?? {}) as { id: string });
        if (result.kind === 'ok') {
          res.json({ row: result.row });
          return;
        }
        if (result.kind === 'notFound') {
          res.status(404).json({ error: 'row not found' });
          return;
        }
        res.status(409).json({ error: 'conflict', currentUpdatedAt: result.currentUpdatedAt });
        return;
      }
      case 'delete': {
        const ok = await deleteSchedule(body.id ?? '');
        res.json({ ok });
        return;
      }
      default:
        res.status(400).json({ error: `unknown action: ${body.action}` });
    }
  } catch (e) {
    console.error('[POST /api/sheets/schedule]', e);
    res.status(500).json(buildErrorPayload(e));
  }
});

/** テスト用 ping */
app.get('/api/ping', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[LINE proxy] http://localhost:${PORT}`);
});
