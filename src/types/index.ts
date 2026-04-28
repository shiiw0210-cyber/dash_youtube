export interface ChannelStats {
  channelId: string;
  channelTitle: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  thumbnailUrl: string;
}

export interface VideoStats {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  description?: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string;
  watchTimeMinutes?: number;
  averageViewDuration?: number;
  impressions?: number;
  ctr?: number;
}

export interface DailyMetrics {
  date: string;
  views: number;
  watchTimeMinutes: number;
  subscribers: number;
  revenue?: number;
}

export interface CsvRow {
  [key: string]: string;
}

export interface ScheduleRow {
  id: string;
  shoot: string;
  shootDate: string;
  deliveryDate: string;
  publishDate: string;
  editor: string;
  thumbnail: string;
  title: string;
  content: string;
  materialUrl: string;
  updatedAt: string;
  todo?: boolean;
}

export type ActiveView =
  | 'overview'
  | 'videos'
  | 'analytics'
  | 'content'
  | 'alerts'
  | 'csv'
  | 'schedule'
  | 'ctr'
  | 'viral'
  | 'settings';

/**
 * 「伸びる動画」分析のための手入力データ。
 * YouTube Data API では取得できない初動データ・トラフィックソース・
 * 主観タグなどを動画単位で保持する。localStorage に永続化される。
 */
export interface ViralExtras {
  videoId: string;
  /** 公開後 24 時間の再生数 */
  views24h?: number;
  /** 公開後 48 時間の再生数 */
  views48h?: number;
  /** 公開後 72 時間の再生数 */
  views72h?: number;
  /** 公開後 7 日の再生数 */
  views7d?: number;
  /** この動画から獲得した登録者数 */
  subscribersGained?: number;
  /** 平均視聴維持率 0〜100 (%) */
  audienceRetentionPct?: number;
  /** トラフィックソース割合 0〜100 (%) — 合計 100% 想定 */
  trafficBrowse?: number;
  trafficSearch?: number;
  trafficSuggested?: number;
  trafficExternal?: number;
  /** 主観タグ（例: "コラボ", "トレンド便乗", "サムネA/B"） */
  tags?: string[];
  /** メモ */
  notes?: string;
  /** 最終更新日時 */
  updatedAt?: string;
}
