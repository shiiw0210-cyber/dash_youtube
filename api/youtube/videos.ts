import type { VercelRequest, VercelResponse } from '@vercel/node';

const BASE = 'https://www.googleapis.com/youtube/v3';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'YOUTUBE_API_KEY が設定されていません' });
    return;
  }

  const { channelId, maxResults = '50' } = req.query;
  if (!channelId || typeof channelId !== 'string') {
    res.status(400).json({ error: 'channelId は必須です' });
    return;
  }

  try {
    // 1. 動画IDリストを取得
    const searchRes = await fetch(
      `${BASE}/search?part=id&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${apiKey}`
    );
    if (!searchRes.ok) {
      const err = await searchRes.json();
      res.status(searchRes.status).json(err);
      return;
    }
    const searchData = await searchRes.json() as { items?: { id: { videoId: string } }[] };
    const ids = searchData.items?.map((i) => i.id.videoId) ?? [];
    if (ids.length === 0) {
      res.json({ items: [] });
      return;
    }

    // 2. 動画詳細を取得
    const videoRes = await fetch(
      `${BASE}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${apiKey}`
    );
    const videoData = await videoRes.json();
    res.status(videoRes.status).json(videoData);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
