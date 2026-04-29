import type { VideoStats, ThumbnailMeta, ThumbnailColor, ThumbnailExpression } from '../types';

export const GENRE_PRESETS: string[] = [
  '顔アップ',
  'リアクション・驚き',
  'ビフォーアフター',
  '比較・対比',
  'ランキング',
  '数字訴求',
  'テキスト主体',
  '商品紹介',
  '場所・風景',
  'コラボ告知',
  'スクショ・引用',
  'イラスト',
];

export const COLOR_LABEL: Record<ThumbnailColor, string> = {
  red: '赤', orange: '橙', yellow: '黄', green: '緑', blue: '青', purple: '紫',
  pink: 'ピンク', black: '黒', white: '白', gray: 'グレー', gradient: 'グラデ', other: 'その他',
};

export const COLOR_HEX: Record<ThumbnailColor, string> = {
  red: '#dc2626', orange: '#ea580c', yellow: '#eab308', green: '#16a34a',
  blue: '#2563eb', purple: '#9333ea', pink: '#ec4899', black: '#111827',
  white: '#f9fafb', gray: '#9ca3af', gradient: '#8b5cf6', other: '#6b7280',
};

export const EXPRESSION_LABEL: Record<ThumbnailExpression, string> = {
  smile: '笑顔', surprise: '驚き', serious: '真剣', angry: '怒り',
  sad: '悲しみ', neutral: '無表情', other: 'その他',
};

export const FACE_LABEL: Record<NonNullable<ThumbnailMeta['faceClose']>, string> = {
  none: '人物なし', partial: '部分', closeup: 'ドアップ',
};

/* ---------------- 共通の集計ユーティリティ ---------------- */

export interface BucketStat {
  key: string;
  label: string;
  count: number;
  avgViews: number;
  avgLikeRate: number;
  totalViews: number;
  videos: VideoStats[];
}

function emptyBucket(key: string, label: string): BucketStat {
  return { key, label, count: 0, avgViews: 0, avgLikeRate: 0, totalViews: 0, videos: [] };
}

function finalize(bucket: BucketStat): BucketStat {
  if (bucket.count === 0) return bucket;
  const totalLikes = bucket.videos.reduce((s, v) => s + v.likeCount, 0);
  return {
    ...bucket,
    avgViews: bucket.totalViews / bucket.count,
    avgLikeRate: bucket.totalViews > 0 ? totalLikes / bucket.totalViews : 0,
  };
}

function add(bucket: BucketStat, v: VideoStats): BucketStat {
  bucket.count += 1;
  bucket.totalViews += v.viewCount;
  bucket.videos.push(v);
  return bucket;
}

/* ---------------- ジャンル別集計 ---------------- */

export function groupByGenre(
  videos: VideoStats[],
  metaMap: Record<string, ThumbnailMeta>
): BucketStat[] {
  const buckets = new Map<string, BucketStat>();
  for (const v of videos) {
    const meta = metaMap[v.videoId];
    const genres = meta?.genres ?? [];
    for (const g of genres) {
      const cur = buckets.get(g) ?? emptyBucket(g, g);
      add(cur, v);
      buckets.set(g, cur);
    }
  }
  return Array.from(buckets.values())
    .map(finalize)
    .filter((b) => b.count >= 1)
    .sort((a, b) => b.avgViews - a.avgViews);
}

/* ---------------- サムネ文字 (ワード) 集計 ---------------- */

const WORD_SPLIT = /[\s,，、。・/／|｜!！?？.「」『』【】[\]()（）]+/;

export interface WordStat {
  word: string;
  count: number;
  avgViews: number;
  totalViews: number;
  videos: VideoStats[];
}

/**
 * サムネ上の文字を入力欄から抽出して集計。
 * 区切り (空白/読点/カンマ/記号) で分割し、2 文字以上の語を採用。
 */
export function analyzeThumbnailWords(
  videos: VideoStats[],
  metaMap: Record<string, ThumbnailMeta>,
  minOccurrence = 2
): WordStat[] {
  const map = new Map<string, WordStat>();

  for (const v of videos) {
    const text = metaMap[v.videoId]?.thumbnailText;
    if (!text) continue;

    // 同一動画内では同じ単語を重複カウントしない
    const seen = new Set<string>();
    for (const raw of text.split(WORD_SPLIT)) {
      const w = raw.trim();
      if (w.length < 2) continue;
      if (seen.has(w)) continue;
      seen.add(w);
      const cur = map.get(w) ?? {
        word: w, count: 0, totalViews: 0, avgViews: 0, videos: [],
      };
      cur.count += 1;
      cur.totalViews += v.viewCount;
      cur.videos.push(v);
      map.set(w, cur);
    }
  }

  return Array.from(map.values())
    .filter((w) => w.count >= minOccurrence)
    .map((w) => ({ ...w, avgViews: w.totalViews / w.count }))
    .sort((a, b) => b.avgViews - a.avgViews);
}

/* ---------------- 個別属性の集計 (色・表情・人物等) ---------------- */

export function groupByField<K extends keyof ThumbnailMeta>(
  videos: VideoStats[],
  metaMap: Record<string, ThumbnailMeta>,
  field: K,
  labelOf: (value: NonNullable<ThumbnailMeta[K]>) => string
): BucketStat[] {
  const buckets = new Map<string, BucketStat>();
  for (const v of videos) {
    const meta = metaMap[v.videoId];
    const value = meta?.[field];
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    const key = String(value);
    const label = labelOf(value as NonNullable<ThumbnailMeta[K]>);
    const cur = buckets.get(key) ?? emptyBucket(key, label);
    add(cur, v);
    buckets.set(key, cur);
  }
  return Array.from(buckets.values())
    .map(finalize)
    .sort((a, b) => b.avgViews - a.avgViews);
}

/* ---------------- 入力カバレッジ ---------------- */

export interface MetaCoverage {
  total: number;
  filled: number;
  withGenre: number;
  withText: number;
  ratio: number;
}

export function computeCoverage(
  videos: VideoStats[],
  metaMap: Record<string, ThumbnailMeta>
): MetaCoverage {
  let filled = 0, withGenre = 0, withText = 0;
  for (const v of videos) {
    const m = metaMap[v.videoId];
    if (!m) continue;
    filled++;
    if (m.genres && m.genres.length > 0) withGenre++;
    if (m.thumbnailText && m.thumbnailText.trim().length > 0) withText++;
  }
  return {
    total: videos.length,
    filled,
    withGenre,
    withText,
    ratio: videos.length > 0 ? filled / videos.length : 0,
  };
}
