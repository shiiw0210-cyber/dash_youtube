import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));

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

/** テスト用 ping */
app.get('/api/ping', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[LINE proxy] http://localhost:${PORT}`);
});
