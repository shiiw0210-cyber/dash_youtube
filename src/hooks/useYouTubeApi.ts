import { useState, useCallback } from 'react';
import type { ChannelStats, VideoStats } from '../types';

const BASE = 'https://www.googleapis.com/youtube/v3';

export function useYouTubeApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChannel = useCallback(async (apiKey: string, channelId: string): Promise<ChannelStats | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${BASE}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
      );
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const data = await res.json();
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

  const fetchVideos = useCallback(async (apiKey: string, channelId: string, maxResults = 50): Promise<VideoStats[]> => {
    setLoading(true);
    setError(null);
    try {
      // 1. 動画IDリストを取得
      const searchRes = await fetch(
        `${BASE}/search?part=id&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${apiKey}`
      );
      if (!searchRes.ok) throw new Error(`API Error: ${searchRes.status}`);
      const searchData = await searchRes.json();
      const ids: string[] = searchData.items?.map((i: { id: { videoId: string } }) => i.id.videoId) ?? [];
      if (ids.length === 0) return [];

      // 2. 動画詳細を取得
      const videoRes = await fetch(
        `${BASE}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${apiKey}`
      );
      if (!videoRes.ok) throw new Error(`API Error: ${videoRes.status}`);
      const videoData = await videoRes.json();

      return videoData.items?.map((item: {
        id: string;
        snippet: { title: string; publishedAt: string; thumbnails: { medium: { url: string } } };
        statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
        contentDetails: { duration: string };
      }) => ({
        videoId: item.id,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails.medium?.url ?? '',
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

  return { fetchChannel, fetchVideos, loading, error };
}
