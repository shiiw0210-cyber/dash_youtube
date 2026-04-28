import type { VideoStats, ViralExtras } from '../types';
import { durationToSeconds } from './videoAnalysis';

export type ViralTier = 'viral' | 'hit' | 'normal' | 'underperform';

export interface ViralMetric {
  video: VideoStats;
  extras?: ViralExtras;
  daysSincePublish: number;
  /** 1日あたり再生数 (現状ベース) */
  viewVelocity: number;
  /** いいね率 */
  likeRate: number;
  /** コメント率 */
  commentRate: number;
  /** エンゲージメント率 (いいね + コメント) / 再生 */
  engagementRate: number;
  /** 24h 初速 (手入力ベース) */
  initialVelocity24h?: number;
  /** 24→72h 失速率 (= 1 - (72h-24h増分 / 24h)) — 0 に近いほど維持、1 に近いほど失速 */
  decay24to72?: number;
  /** 視聴維持率 (CSV または 手入力) 0〜1 */
  retentionRatio?: number;
  /** 登録者獲得効率 = subscribersGained / viewCount */
  subscriberEfficiency?: number;
  /** CTR (CSV) */
  ctr?: number;
  /** 0〜100 の総合スコア */
  viralScore: number;
  /** チャンネル中央値比 */
  ratioVsMedian: number;
  /** 動画の階層 */
  tier: ViralTier;
}

export interface PublishTimingBucket {
  key: string;
  label: string;
  count: number;
  avgViews: number;
  avgScore: number;
  totalViews: number;
}

export interface PatternInsight {
  label: string;
  type: 'length' | 'keyword' | 'tag' | 'dayOfWeek' | 'hourBand';
  topShare: number; // top tier に占める割合
  bottomShare: number; // bottom tier に占める割合
  lift: number; // top vs bottom の差 (倍率)
  topCount: number;
  bottomCount: number;
}

/* ---------------- 基礎指標 ---------------- */

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function daysBetween(from: string, to: Date = new Date()): number {
  const d = new Date(from);
  const ms = to.getTime() - d.getTime();
  return Math.max(1, ms / 86_400_000);
}

/**
 * CSV から取り込んだ averageViewDuration (秒) と動画長 (ISO) から維持率を算出
 */
function csvRetention(v: VideoStats): number | undefined {
  if (!v.averageViewDuration) return undefined;
  const total = durationToSeconds(v.duration);
  if (total <= 0) return undefined;
  return clamp(v.averageViewDuration / total, 0, 1);
}

/* ---------------- メイン算出 ---------------- */

/**
 * チャンネル全体の動画 + 手入力データから ViralMetric を生成。
 * viralScore はチャンネル内の相対指標 (中央値・四分位) に基づく 0〜100 値。
 */
export function computeViralMetrics(
  videos: VideoStats[],
  extrasMap: Record<string, ViralExtras> = {}
): ViralMetric[] {
  if (videos.length === 0) return [];

  const velocities = videos.map((v) => safeDiv(v.viewCount, daysBetween(v.publishedAt)));
  const medianVelocity = median(velocities);
  const p75Velocity = quantile(velocities, 0.75);
  const p90Velocity = quantile(velocities, 0.9);
  const p25Velocity = quantile(velocities, 0.25);

  const engagementValues = videos.map((v) =>
    safeDiv(v.likeCount + v.commentCount, v.viewCount)
  );
  const medianEngagement = median(engagementValues);

  return videos.map((v) => {
    const days = daysBetween(v.publishedAt);
    const viewVelocity = safeDiv(v.viewCount, days);
    const likeRate = safeDiv(v.likeCount, v.viewCount);
    const commentRate = safeDiv(v.commentCount, v.viewCount);
    const engagementRate = likeRate + commentRate;
    const extras = extrasMap[v.videoId];

    const initialVelocity24h = extras?.views24h;
    const decay24to72 =
      extras?.views24h && extras?.views72h && extras.views24h > 0
        ? clamp(1 - safeDiv(extras.views72h - extras.views24h, extras.views24h), 0, 1)
        : undefined;

    const retentionRatio =
      extras?.audienceRetentionPct != null
        ? clamp(extras.audienceRetentionPct / 100, 0, 1)
        : csvRetention(v);

    const subscriberEfficiency =
      extras?.subscribersGained != null
        ? safeDiv(extras.subscribersGained, v.viewCount)
        : undefined;

    // --- スコアリング ---
    // velocity を中央値正規化 (0〜2 程度) → 0〜50 にマップ
    const velocityScore =
      medianVelocity > 0
        ? clamp((viewVelocity / medianVelocity) * 25, 0, 50)
        : 0;
    // engagement (中央値の 2 倍以上で満点) → 0〜20
    const engagementScore =
      medianEngagement > 0
        ? clamp((engagementRate / medianEngagement) * 10, 0, 20)
        : clamp(engagementRate * 2000, 0, 20);
    // CTR があれば 0〜10 (10% で満点)
    const ctrScore = v.ctr != null ? clamp(v.ctr * 100, 0, 10) : 0;
    // 維持率があれば 0〜10 (50% で満点)
    const retentionScore =
      retentionRatio != null ? clamp(retentionRatio * 20, 0, 10) : 0;
    // 初速ボーナス (手入力): 24h 視聴 / 中央値日次の 1.5 倍超でボーナス +0〜10
    const initialBonus =
      initialVelocity24h != null && medianVelocity > 0
        ? clamp((initialVelocity24h / (medianVelocity * 1.5)) * 5, 0, 10)
        : 0;

    const viralScore = Math.round(
      velocityScore + engagementScore + ctrScore + retentionScore + initialBonus
    );

    const ratioVsMedian = medianVelocity > 0 ? viewVelocity / medianVelocity : 0;

    let tier: ViralTier;
    if (viewVelocity >= p90Velocity && viralScore >= 60) tier = 'viral';
    else if (viewVelocity >= p75Velocity) tier = 'hit';
    else if (viewVelocity <= p25Velocity) tier = 'underperform';
    else tier = 'normal';

    return {
      video: v,
      extras,
      daysSincePublish: days,
      viewVelocity,
      likeRate,
      commentRate,
      engagementRate,
      initialVelocity24h,
      decay24to72,
      retentionRatio,
      subscriberEfficiency,
      ctr: v.ctr,
      viralScore,
      ratioVsMedian,
      tier,
    };
  });
}

/* ---------------- 公開タイミング分析 ---------------- */

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export function groupByDayOfWeek(metrics: ViralMetric[]): PublishTimingBucket[] {
  const buckets: Record<number, ViralMetric[]> = {};
  for (const m of metrics) {
    const d = new Date(m.video.publishedAt).getDay();
    (buckets[d] ??= []).push(m);
  }
  return Object.keys(buckets)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((d) => {
      const items = buckets[d];
      const totalViews = items.reduce((s, m) => s + m.video.viewCount, 0);
      const avgScore =
        items.reduce((s, m) => s + m.viralScore, 0) / items.length;
      return {
        key: String(d),
        label: DOW_LABELS[d] + '曜',
        count: items.length,
        totalViews,
        avgViews: totalViews / items.length,
        avgScore,
      };
    });
}

const HOUR_BANDS: { label: string; from: number; to: number }[] = [
  { label: '深夜 0-6時', from: 0, to: 6 },
  { label: '朝 6-9時', from: 6, to: 9 },
  { label: '午前 9-12時', from: 9, to: 12 },
  { label: '昼 12-15時', from: 12, to: 15 },
  { label: '夕方 15-18時', from: 15, to: 18 },
  { label: '夜 18-21時', from: 18, to: 21 },
  { label: '深夜前 21-24時', from: 21, to: 24 },
];

export function groupByHourBand(metrics: ViralMetric[]): PublishTimingBucket[] {
  return HOUR_BANDS.map((band) => {
    const items = metrics.filter((m) => {
      const h = new Date(m.video.publishedAt).getHours();
      return h >= band.from && h < band.to;
    });
    if (items.length === 0) {
      return {
        key: band.label,
        label: band.label,
        count: 0,
        totalViews: 0,
        avgViews: 0,
        avgScore: 0,
      };
    }
    const totalViews = items.reduce((s, m) => s + m.video.viewCount, 0);
    return {
      key: band.label,
      label: band.label,
      count: items.length,
      totalViews,
      avgViews: totalViews / items.length,
      avgScore: items.reduce((s, m) => s + m.viralScore, 0) / items.length,
    };
  }).filter((b) => b.count > 0);
}

/* ---------------- 上位 vs 下位の差分パターン ---------------- */

/**
 * Top tier (viral + hit) と underperform tier を比較して、
 * 共通する特徴 (タグ、長さ帯、曜日) のリフトを算出。
 */
export function comparePatterns(metrics: ViralMetric[]): PatternInsight[] {
  const top = metrics.filter((m) => m.tier === 'viral' || m.tier === 'hit');
  const bottom = metrics.filter((m) => m.tier === 'underperform');
  if (top.length === 0 || bottom.length === 0) return [];

  const insights: PatternInsight[] = [];

  // 1. 曜日
  const dowTop = countBy(top, (m) => DOW_LABELS[new Date(m.video.publishedAt).getDay()] + '曜');
  const dowBot = countBy(bottom, (m) => DOW_LABELS[new Date(m.video.publishedAt).getDay()] + '曜');
  pushLifts(insights, 'dayOfWeek', dowTop, dowBot, top.length, bottom.length);

  // 2. 時間帯
  const hourTop = countBy(top, (m) => labelHourBand(new Date(m.video.publishedAt).getHours()));
  const hourBot = countBy(bottom, (m) => labelHourBand(new Date(m.video.publishedAt).getHours()));
  pushLifts(insights, 'hourBand', hourTop, hourBot, top.length, bottom.length);

  // 3. 長さ帯
  const lenTop = countBy(top, (m) => labelLength(durationToSeconds(m.video.duration)));
  const lenBot = countBy(bottom, (m) => labelLength(durationToSeconds(m.video.duration)));
  pushLifts(insights, 'length', lenTop, lenBot, top.length, bottom.length);

  // 4. 手入力タグ
  const tagTop = new Map<string, number>();
  const tagBot = new Map<string, number>();
  for (const m of top) for (const t of m.extras?.tags ?? []) tagTop.set(t, (tagTop.get(t) ?? 0) + 1);
  for (const m of bottom) for (const t of m.extras?.tags ?? []) tagBot.set(t, (tagBot.get(t) ?? 0) + 1);
  pushLifts(insights, 'tag', tagTop, tagBot, top.length, bottom.length);

  return insights
    .filter((i) => i.topCount + i.bottomCount >= 2)
    .sort((a, b) => Math.abs(b.lift - 1) - Math.abs(a.lift - 1))
    .slice(0, 12);
}

function countBy<T>(items: T[], key: (t: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function pushLifts(
  out: PatternInsight[],
  type: PatternInsight['type'],
  topMap: Map<string, number>,
  botMap: Map<string, number>,
  topTotal: number,
  botTotal: number
) {
  const labels = new Set([...topMap.keys(), ...botMap.keys()]);
  for (const label of labels) {
    const tc = topMap.get(label) ?? 0;
    const bc = botMap.get(label) ?? 0;
    const topShare = tc / topTotal;
    const bottomShare = bc / botTotal;
    // ラプラス補正で 0 除算回避
    const lift = (topShare + 0.01) / (bottomShare + 0.01);
    out.push({ label, type, topShare, bottomShare, lift, topCount: tc, bottomCount: bc });
  }
}

function labelHourBand(h: number): string {
  return HOUR_BANDS.find((b) => h >= b.from && h < b.to)?.label ?? '不明';
}

function labelLength(sec: number): string {
  if (sec < 60) return 'ショート (〜60秒)';
  if (sec < 300) return '短尺 (1〜5分)';
  if (sec < 900) return '中尺 (5〜15分)';
  if (sec < 1800) return '長尺 (15〜30分)';
  return '超長尺 (30分〜)';
}

export const TIER_LABEL: Record<ViralTier, string> = {
  viral: 'バイラル',
  hit: 'ヒット',
  normal: '平均',
  underperform: '伸び悩み',
};

export const TIER_COLOR: Record<ViralTier, string> = {
  viral: '#dc2626',
  hit: '#ea580c',
  normal: '#6b7280',
  underperform: '#3b82f6',
};
