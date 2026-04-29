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
  | 'thumbnail'
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

/**
 * サムネイル分析のための手入力メタデータ。
 * ジャンル・サムネ上の文字・人物数・色合いなどを動画ごとに登録し、
 * 伸びているサムネのパターンを抽出する。localStorage に永続化される。
 */
export interface ThumbnailMeta {
  videoId: string;
  /** ジャンル/型 (複数選択可)。例: "顔アップ", "ビフォーアフター", "ランキング" */
  genres?: string[];
  /** サムネ上に表示している文字 (カンマ/読点/スペース区切り) */
  thumbnailText?: string;
  /** メイン背景色 */
  bgColor?: ThumbnailColor;
  /** 文字色 */
  textColor?: ThumbnailColor;
  /** 写っている人数 0=なし / 1〜4=人数 / 5=5人以上 */
  personCount?: 0 | 1 | 2 | 3 | 4 | 5;
  /** 顔の写り方 */
  faceClose?: 'none' | 'partial' | 'closeup';
  /** メインの表情 */
  expression?: ThumbnailExpression;
  /** 数字を強調表示しているか */
  hasNumber?: boolean;
  /** 矢印・装飾枠を使っているか */
  hasArrow?: boolean;
  /** 自由記述メモ */
  notes?: string;
  /** 最終更新日時 */
  updatedAt?: string;
}

export type ThumbnailColor =
  | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink'
  | 'black' | 'white' | 'gray' | 'gradient' | 'other';

export type ThumbnailExpression =
  | 'smile' | 'surprise' | 'serious' | 'angry' | 'sad' | 'neutral' | 'other';
