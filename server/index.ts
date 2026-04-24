import express from 'express';
import cors from 'cors';
import analyticsHandler from '../api/youtube/analytics.js';

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

/** Google Apps Script Web App プロキシ (スケジュールシート) */
async function proxyGas(body: Record<string, unknown> | null, res: express.Response) {
  const url = process.env.GAS_WEB_APP_URL;
  const secret = process.env.GAS_SHARED_SECRET;
  if (!url || !secret) {
    res.status(500).json({ error: 'GAS_WEB_APP_URL / GAS_SHARED_SECRET が設定されていません' });
    return;
  }
  try {
    const gasRes = body === null
      ? await fetch(`${url}?secret=${encodeURIComponent(secret)}`, { redirect: 'follow' })
      : await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, secret }),
          redirect: 'follow',
        });
    const data = await gasRes.json().catch(() => ({}));
    const status = typeof (data as { status?: number }).status === 'number'
      ? (data as { status: number }).status
      : gasRes.status;
    res.status(status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

app.get('/api/sheets/schedule', async (_req, res) => {
  await proxyGas(null, res);
});

app.post('/api/sheets/schedule', async (req, res) => {
  await proxyGas(req.body ?? {}, res);
});

/** YouTube Analytics API proxy (local dev) */
app.get('/api/youtube/analytics', async (req, res) => {
  // Vercel ハンドラーと Express Request/Response は互換性があるのでそのまま委譲
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await analyticsHandler(req as any, res as any);
});

/** テスト用 ping */
app.get('/api/ping', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[LINE proxy] http://localhost:${PORT}`);
});
