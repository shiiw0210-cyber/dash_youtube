import type { VercelRequest, VercelResponse } from '@vercel/node';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const DEFAULT_THRESHOLD = 350;
const WINDOW_START_HOURS = 24;
const WINDOW_END_HOURS = 48;

interface YouTubeSearchItem {
  id: { videoId: string };
}
interface YouTubeVideoItem {
  id: string;
  snippet: { title: string; publishedAt: string };
  statistics: { viewCount?: string };
}
interface LowViewVideo {
  videoId: string;
  title: string;
  viewCount: number;
  hoursSincePublished: number;
}

function buildMessageText(videos: LowViewVideo[], threshold: number): string {
  const lines: string[] = [
    `📉 24時間で再生数が伸び悩んでいる動画があります（閾値: ${threshold}回以下）`,
    '─────────────────',
  ];
  for (const v of videos.slice(0, 5)) {
    const title = v.title.length > 30 ? `${v.title.slice(0, 30)}…` : v.title;
    lines.push(
      `🎬 ${title}`,
      `　公開から ${Math.floor(v.hoursSincePublished)}h / 再生数: ${v.viewCount.toLocaleString()}回`,
      `　▶ https://www.youtube.com/watch?v=${v.videoId}`
    );
  }
  if (videos.length > 5) {
    lines.push(`…他 ${videos.length - 5} 件`);
  }
  return lines.join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const lineGroupId = process.env.LINE_GROUP_ID;
  const threshold = Number(process.env.LOW_VIEW_THRESHOLD ?? DEFAULT_THRESHOLD);

  const missing: string[] = [];
  if (!youtubeApiKey) missing.push('YOUTUBE_API_KEY');
  if (!channelId) missing.push('YOUTUBE_CHANNEL_ID');
  if (!lineToken) missing.push('LINE_CHANNEL_ACCESS_TOKEN');
  if (!lineGroupId) missing.push('LINE_GROUP_ID');
  if (missing.length > 0) {
    res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` });
    return;
  }

  try {
    const searchRes = await fetch(
      `${YT_BASE}/search?part=id&channelId=${channelId}&type=video&order=date&maxResults=50&key=${youtubeApiKey}`
    );
    if (!searchRes.ok) {
      const err = await searchRes.json().catch(() => ({}));
      res.status(searchRes.status).json({ error: 'YouTube search failed', detail: err });
      return;
    }
    const searchData = (await searchRes.json()) as { items?: YouTubeSearchItem[] };
    const ids = searchData.items?.map((i) => i.id.videoId).filter(Boolean) ?? [];
    if (ids.length === 0) {
      res.json({ ok: true, checked: 0, notified: 0 });
      return;
    }

    const videoRes = await fetch(
      `${YT_BASE}/videos?part=snippet,statistics&id=${ids.join(',')}&key=${youtubeApiKey}`
    );
    if (!videoRes.ok) {
      const err = await videoRes.json().catch(() => ({}));
      res.status(videoRes.status).json({ error: 'YouTube videos failed', detail: err });
      return;
    }
    const videoData = (await videoRes.json()) as { items?: YouTubeVideoItem[] };

    const now = Date.now();
    const lowView: LowViewVideo[] = [];
    for (const item of videoData.items ?? []) {
      const publishedAtMs = new Date(item.snippet.publishedAt).getTime();
      if (Number.isNaN(publishedAtMs)) continue;
      const hours = (now - publishedAtMs) / (1000 * 60 * 60);
      if (hours < WINDOW_START_HOURS || hours >= WINDOW_END_HOURS) continue;

      const views = parseInt(item.statistics.viewCount ?? '0', 10);
      if (views <= threshold) {
        lowView.push({
          videoId: item.id,
          title: item.snippet.title,
          viewCount: views,
          hoursSincePublished: hours,
        });
      }
    }

    if (lowView.length === 0) {
      res.json({ ok: true, checked: videoData.items?.length ?? 0, notified: 0 });
      return;
    }

    const lineRes = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lineToken}`,
      },
      body: JSON.stringify({
        to: lineGroupId,
        messages: [{ type: 'text', text: buildMessageText(lowView, threshold) }],
      }),
    });
    if (!lineRes.ok) {
      const err = await lineRes.json().catch(() => ({}));
      res.status(lineRes.status).json({ error: 'LINE push failed', detail: err });
      return;
    }

    res.json({
      ok: true,
      checked: videoData.items?.length ?? 0,
      notified: lowView.length,
      videos: lowView.map((v) => ({ videoId: v.videoId, viewCount: v.viewCount })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
