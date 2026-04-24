export interface ChannelStats {
  channelId: string;
  channelTitle: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  thumbnailUrl: string;
}

export interface AnalyticsTotals {
  views?: number;
  estimatedMinutesWatched?: number;
  subscribersGained?: number;
  estimatedRevenue?: number;
  impressions?: number;
  averageCtr?: number;
  startDate?: string;
  endDate?: string;
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
  averageViewPercentage?: number;
  impressions?: number;
  ctr?: number;
  estimatedRevenue?: number;
  subscribersGained?: number;
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
  | 'settings';
