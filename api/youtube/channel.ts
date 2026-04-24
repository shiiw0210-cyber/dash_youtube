import type { VercelRequest, VercelResponse } from '@vercel/node';

const BASE = 'https://www.googleapis.com/youtube/v3';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'YOUTUBE_API_KEY が設定されていません' });
    return;
  }

  const { channelId } = req.query;
  if (!channelId || typeof channelId !== 'string') {
    res.status(400).json({ error: 'channelId は必須です' });
    return;
  }

  try {
    const response = await fetch(
      `${BASE}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
    );
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
