import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAccessToken, loadOAuthCreds } from '../../lib/googleOAuth.js';

const ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2/reports';
const LIFETIME_START = '2005-02-14';

interface AnalyticsResponse {
  columnHeaders?: { name: string }[];
  rows?: (string | number)[][];
  error?: { message?: string };
}

interface VideoMetrics {
  videoId: string;
  views?: number;
  impressions?: number;
  ctr?: number;
  averageViewPercentage?: number;
  averageViewDuration?: number;
  estimatedMinutesWatched?: number;
  estimatedRevenue?: number;
  subscribersGained?: number;
}

interface ChannelTotals {
  views?: number;
  estimatedMinutesWatched?: number;
  subscribersGained?: number;
  estimatedRevenue?: number;
  impressions?: number;
  averageCtr?: number;
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rowsToRecords(data: AnalyticsResponse): Record<string, unknown>[] {
  const headers = data.columnHeaders?.map((h) => h.name) ?? [];
  return (data.rows ?? []).map((row) => {
    const rec: Record<string, unknown> = {};
    headers.forEach((h, i) => (rec[h] = row[i]));
    return rec;
  });
}

async function callAnalytics(
  accessToken: string,
  params: Record<string, string>
): Promise<AnalyticsResponse> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${ANALYTICS_BASE}?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (await res.json().catch(() => ({}))) as AnalyticsResponse;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { creds, missing } = loadOAuthCreds();
  if (!creds) {
    res.status(500).json({
      error: 'OAuth credentials missing',
      missing,
      hint: 'Vercel の環境変数に GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN を登録してください。',
    });
    return;
  }

  const videoIdsParam = typeof req.query.videoIds === 'string' ? req.query.videoIds : '';
  const videoIds = videoIdsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);

  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : LIFETIME_START;
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : toYmd(new Date());

  try {
    const accessToken = await getAccessToken(creds);

    const commonParams = {
      ids: 'channel==MINE',
      startDate,
      endDate,
    };

    const metrics =
      'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,estimatedRevenue';

    const perVideoMap = new Map<string, VideoMetrics>();
    videoIds.forEach((id) => perVideoMap.set(id, { videoId: id }));

    if (videoIds.length > 0) {
      const coreData = await callAnalytics(accessToken, {
        ...commonParams,
        metrics,
        dimensions: 'video',
        filters: `video==${videoIds.join(',')}`,
        maxResults: '200',
      });

      if (coreData.error) {
        res.status(500).json({ error: coreData.error.message ?? 'Analytics API error', stage: 'core' });
        return;
      }

      for (const rec of rowsToRecords(coreData)) {
        const videoId = rec['video'] as string;
        if (!videoId) continue;
        const entry = perVideoMap.get(videoId) ?? { videoId };
        entry.views = Number(rec['views'] ?? 0) || 0;
        entry.estimatedMinutesWatched = Number(rec['estimatedMinutesWatched'] ?? 0) || 0;
        entry.averageViewDuration = Number(rec['averageViewDuration'] ?? 0) || 0;
        entry.averageViewPercentage = Number(rec['averageViewPercentage'] ?? 0) || 0;
        entry.subscribersGained = Number(rec['subscribersGained'] ?? 0) || 0;
        const rev = rec['estimatedRevenue'];
        if (rev !== undefined && rev !== null) entry.estimatedRevenue = Number(rev) || 0;
        perVideoMap.set(videoId, entry);
      }

      const ctrData = await callAnalytics(accessToken, {
        ...commonParams,
        metrics: 'cardImpressions,cardClickRate,impressions,impressionClickThroughRate',
        dimensions: 'video',
        filters: `video==${videoIds.join(',')}`,
        maxResults: '200',
      });

      if (!ctrData.error) {
        for (const rec of rowsToRecords(ctrData)) {
          const videoId = rec['video'] as string;
          if (!videoId) continue;
          const entry = perVideoMap.get(videoId) ?? { videoId };
          entry.impressions = Number(rec['impressions'] ?? 0) || 0;
          entry.ctr = Number(rec['impressionClickThroughRate'] ?? 0) || 0;
          perVideoMap.set(videoId, entry);
        }
      }
    }

    const channelData = await callAnalytics(accessToken, {
      ...commonParams,
      metrics: `${metrics},impressions,impressionClickThroughRate`,
    });

    const totals: ChannelTotals = {};
    const totalRecs = rowsToRecords(channelData);
    if (totalRecs[0]) {
      const row = totalRecs[0];
      totals.views = Number(row['views'] ?? 0) || 0;
      totals.estimatedMinutesWatched = Number(row['estimatedMinutesWatched'] ?? 0) || 0;
      totals.subscribersGained = Number(row['subscribersGained'] ?? 0) || 0;
      const rev = row['estimatedRevenue'];
      if (rev !== undefined && rev !== null) totals.estimatedRevenue = Number(rev) || 0;
      totals.impressions = Number(row['impressions'] ?? 0) || 0;
      totals.averageCtr = Number(row['impressionClickThroughRate'] ?? 0) || 0;
    }

    res.json({
      startDate,
      endDate,
      videos: Array.from(perVideoMap.values()),
      totals,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
