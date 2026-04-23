import type { VideoStats } from '../types';

export interface ThumbnailAlert {
  video: VideoStats;
  hoursAgo: number;
  currentViews: number;
  threshold: number;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface AlertConfig {
  /** 評価対象にする投稿後の時間（時間） */
  windowHours: number;
  /** チャンネル平均の何割を下回ったらアラートにするか */
  underperformRatio: number;
  /** 固定閾値（指定があればこちらを優先） */
  minViewsOverride?: number;
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  windowHours: 24,
  underperformRatio: 0.5, // 平均の50%未満
};

/**
 * 24時間以内に投稿された動画のうち、パフォーマンスが低いものを抽出
 */
export function detectThumbnailAlerts(
  videos: VideoStats[],
  config: AlertConfig = DEFAULT_ALERT_CONFIG
): ThumbnailAlert[] {
  const now = Date.now();
  const alerts: ThumbnailAlert[] = [];

  // 成熟動画（30日以上経過）の平均再生数を基準にする
  const mature = videos.filter((v) => {
    const age = (now - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    return age >= 30;
  });

  const maturedAvgViews =
    mature.length > 0 ? mature.reduce((s, v) => s + v.viewCount, 0) / mature.length : 0;

  // 評価対象＝投稿後 windowHours 以内（± 余裕）
  for (const v of videos) {
    const hoursAgo = (now - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 0 || hoursAgo > config.windowHours * 3) continue;

    // 閾値の決定
    let threshold: number;
    if (config.minViewsOverride !== undefined) {
      threshold = config.minViewsOverride;
    } else if (maturedAvgViews > 0) {
      // 投稿後の経過時間で按分（簡易）
      // 成熟動画の平均を24時間相当で換算
      // 公開数日なら成熟値の10%、24h以内なら5%程度が目安
      const ratioOfMature = Math.min(hoursAgo / (30 * 24), 0.1);
      threshold = maturedAvgViews * ratioOfMature * config.underperformRatio;
    } else {
      // データが足りない場合のフォールバック
      threshold = 100;
    }

    if (v.viewCount < threshold && hoursAgo >= config.windowHours * 0.5) {
      const severity: ThumbnailAlert['severity'] =
        v.viewCount < threshold * 0.3 ? 'high' : v.viewCount < threshold * 0.6 ? 'medium' : 'low';
      alerts.push({
        video: v,
        hoursAgo,
        currentViews: v.viewCount,
        threshold: Math.round(threshold),
        severity,
        message: `投稿から ${Math.floor(hoursAgo)} 時間で ${v.viewCount.toLocaleString()} 回視聴（目安 ${Math.round(threshold).toLocaleString()} 回）`,
      });
    }
  }

  return alerts.sort((a, b) => a.currentViews / a.threshold - b.currentViews / b.threshold);
}
