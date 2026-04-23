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

export type ActiveView =
  | 'overview'
  | 'videos'
  | 'analytics'
  | 'content'
  | 'alerts'
  | 'csv'
  | 'settings';
