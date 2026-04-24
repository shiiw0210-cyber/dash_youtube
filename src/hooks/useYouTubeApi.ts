import { useState, useCallback } from 'react';
import type { ChannelStats, VideoStats, AnalyticsTotals } from '../types';

export interface AnalyticsResult {
  videos: Partial<VideoStats>[];
  totals: AnalyticsTotals;
}

export function useYouTubeApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const fetchChannel = useCallback(async (channelId: string): Promise<ChannelStats | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/youtube/channel?channelId=${encodeURIComponent(channelId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: { message?: string } | string };
        const msg = typeof data.error === 'object' ? data.error?.message : data.error;
        throw new Error(msg ?? `API Error: ${res.status}`);
      }
      const data = await res.json() as { items?: {
        id: string;
        snippet: { title: string; thumbnails: { default: { url: string } } };
        statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string };
      }[] };
      const item = data.items?.[0];
      if (!item) throw new Error('チャンネルが見つかりません');
      return {
        channelId: item.id,
        channelTitle: item.snippet.title,
        subscriberCount: parseInt(item.statistics.subscriberCount ?? '0'),
        viewCount: parseInt(item.statistics.viewCount ?? '0'),
        videoCount: parseInt(item.statistics.videoCount ?? '0'),
        thumbnailUrl: item.snippet.thumbnails.default.url,
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラー');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVideos = useCallback(async (channelId: string, maxResults = 50): Promise<VideoStats[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/youtube/videos?channelId=${encodeURIComponent(channelId)}&maxResults=${maxResults}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: { message?: string } | string };
        const msg = typeof data.error === 'object' ? data.error?.message : data.error;
        throw new Error(msg ?? `API Error: ${res.status}`);
      }
      const videoData = await res.json() as { items?: {
        id: string;
        snippet: { title: string; publishedAt: string; description: string; thumbnails: { medium: { url: string } } };
        statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
        contentDetails: { duration: string };
      }[] };

      return videoData.items?.map((item) => ({
        videoId: item.id,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails.medium?.url ?? '',
        description: item.snippet.description ?? '',
        viewCount: parseInt(item.statistics.viewCount ?? '0'),
        likeCount: parseInt(item.statistics.likeCount ?? '0'),
        commentCount: parseInt(item.statistics.commentCount ?? '0'),
        duration: item.contentDetails.duration,
      })) ?? [];
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラー');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(
    async (videoIds: string[]): Promise<AnalyticsResult | null> => {
      if (videoIds.length === 0) return null;
      setAnalyticsError(null);
      try {
        const res = await fetch(
          `/api/youtube/analytics?videoIds=${encodeURIComponent(videoIds.join(','))}`
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            missing?: string[];
            hint?: string;
          };
          const msg = data.missing?.length
            ? `OAuth 未設定: ${data.missing.join(', ')}`
            : data.error ?? `API Error: ${res.status}`;
          throw new Error(msg);
        }
        const data = (await res.json()) as {
          videos: Array<{
            videoId: string;
            views?: number;
            impressions?: number;
            ctr?: number;
            averageViewPercentage?: number;
            averageViewDuration?: number;
            estimatedMinutesWatched?: number;
            estimatedRevenue?: number;
            subscribersGained?: number;
          }>;
          totals: AnalyticsTotals;
          startDate: string;
          endDate: string;
        };

        const mergedVideos: Partial<VideoStats>[] = data.videos.map((v) => ({
          videoId: v.videoId,
          impressions: v.impressions,
          ctr: v.ctr,
          averageViewPercentage: v.averageViewPercentage,
          averageViewDuration: v.averageViewDuration,
          watchTimeMinutes: v.estimatedMinutesWatched,
          estimatedRevenue: v.estimatedRevenue,
          subscribersGained: v.subscribersGained,
        }));

        return {
          videos: mergedVideos,
          totals: { ...data.totals, startDate: data.startDate, endDate: data.endDate },
        };
      } catch (e) {
        setAnalyticsError(e instanceof Error ? e.message : '不明なエラー');
        return null;
      }
    },
    []
  );

  return { fetchChannel, fetchVideos, fetchAnalytics, loading, error, analyticsError };
}
