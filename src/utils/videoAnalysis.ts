import type { VideoStats } from '../types';

export interface LengthBucket {
  label: string;
  minSec: number;
  maxSec: number;
  videos: VideoStats[];
  count: number;
  avgViews: number;
  avgLikes: number;
  likeRate: number; // いいね率 = likes / views
}

const BUCKETS: { label: string; minSec: number; maxSec: number }[] = [
  { label: 'ショート (〜60秒)', minSec: 0, maxSec: 60 },
  { label: '短尺 (1〜5分)', minSec: 60, maxSec: 300 },
  { label: '中尺 (5〜15分)', minSec: 300, maxSec: 900 },
  { label: '長尺 (15〜30分)', minSec: 900, maxSec: 1800 },
  { label: '超長尺 (30分〜)', minSec: 1800, maxSec: Number.MAX_SAFE_INTEGER },
];

export function durationToSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? '0');
  const mn = parseInt(m[2] ?? '0');
  const s = parseInt(m[3] ?? '0');
  return h * 3600 + mn * 60 + s;
}

export function groupByLength(videos: VideoStats[]): LengthBucket[] {
  return BUCKETS.map((b) => {
    const inBucket = videos.filter((v) => {
      const sec = durationToSeconds(v.duration);
      return sec >= b.minSec && sec < b.maxSec;
    });
    const totalViews = inBucket.reduce((s, v) => s + v.viewCount, 0);
    const totalLikes = inBucket.reduce((s, v) => s + v.likeCount, 0);
    return {
      label: b.label,
      minSec: b.minSec,
      maxSec: b.maxSec,
      videos: inBucket,
      count: inBucket.length,
      avgViews: inBucket.length > 0 ? totalViews / inBucket.length : 0,
      avgLikes: inBucket.length > 0 ? totalLikes / inBucket.length : 0,
      likeRate: totalViews > 0 ? totalLikes / totalViews : 0,
    };
  }).filter((b) => b.count > 0);
}
