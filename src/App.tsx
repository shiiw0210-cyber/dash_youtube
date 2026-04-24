import { useState, useEffect, useCallback } from 'react';
import { Menu, Youtube, RefreshCw, Monitor } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Overview } from './components/Overview';
import { VideoTable } from './components/VideoTable';
import { Charts } from './components/Charts';
import { ContentAnalysis } from './components/ContentAnalysis';
import { Alerts } from './components/Alerts';
import { CsvImport } from './components/CsvImport';
import { Settings } from './components/Settings';
import { Schedule } from './components/Schedule';
import { CtrRanking } from './components/CtrRanking';
import { useYouTubeApi } from './hooks/useYouTubeApi';
import type { ActiveView, ChannelStats, VideoStats, DailyMetrics, AnalyticsTotals } from './types';

const CHANNEL_ID = 'UCmxAaack6dmXAxwgnhzX0MQ';

export function App() {
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [channel, setChannel] = useState<ChannelStats | null>(null);
  const [videos, setVideos] = useState<VideoStats[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([]);
  const [analyticsTotals, setAnalyticsTotals] = useState<AnalyticsTotals | null>(null);

  const { fetchChannel, fetchVideos, fetchAnalytics, loading, error, analyticsError } = useYouTubeApi();

  const handleFetch = useCallback(async () => {
    const [ch, vids] = await Promise.all([
      fetchChannel(CHANNEL_ID),
      fetchVideos(CHANNEL_ID),
    ]);
    if (ch) setChannel(ch);
    if (vids.length === 0) return;

    setVideos(vids);

    const analytics = await fetchAnalytics(vids.map((v) => v.videoId));
    if (!analytics) return;

    const byId = new Map(analytics.videos.map((v) => [v.videoId, v]));
    setVideos((prev) =>
      prev.map((v) => {
        const a = byId.get(v.videoId);
        return a ? { ...v, ...a } : v;
      })
    );
    setAnalyticsTotals(analytics.totals);
  }, [fetchChannel, fetchVideos, fetchAnalytics]);

  function handleToggleMobilePreview() {
    setMobilePreview((prev) => {
      if (!prev) setSidebarOpen(false);
      return !prev;
    });
  }

  // CSVの動画別データをAPIデータとマージ
  function handleVideoMetrics(csvRows: Partial<VideoStats>[]) {
    setVideos((prev) =>
      prev.map((v) => {
        const match = csvRows.find(
          (r) => r.title && v.title.includes(r.title.slice(0, 20))
        );
        return match ? { ...v, ...match } : v;
      })
    );
  }

  // 初回ロード
  useEffect(() => {
    handleFetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`app${mobilePreview ? ' force-mobile' : ''}`}>
      <header className="mobile-header">
        <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="メニューを開く">
          <Menu size={22} />
        </button>
        <Youtube size={22} color="#FF0000" />
        <span className="mobile-title">YouTube Analytics</span>
        {mobilePreview && (
          <button
            className="mobile-exit-preview"
            onClick={handleToggleMobilePreview}
            aria-label="デスクトップ表示に切替"
            title="デスクトップ表示に切替"
          >
            <Monitor size={18} />
          </button>
        )}
        <button className="mobile-refresh" onClick={handleFetch} disabled={loading} aria-label="データ更新">
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
      </header>
      <Sidebar
        active={activeView}
        onChange={setActiveView}
        channelTitle={channel?.channelTitle}
        thumbnailUrl={channel?.thumbnailUrl}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        mobilePreview={mobilePreview}
        onToggleMobilePreview={handleToggleMobilePreview}
      />
      <main className="main">
        {activeView === 'overview' && (
          <Overview
            channel={channel}
            videos={videos}
            analyticsTotals={analyticsTotals}
            analyticsError={analyticsError}
          />
        )}
        {activeView === 'schedule' && <Schedule videos={videos} />}
        {activeView === 'alerts' && <Alerts videos={videos} />}
        {activeView === 'ctr' && <CtrRanking videos={videos} />}
        {activeView === 'videos' && <VideoTable videos={videos} />}
        {activeView === 'analytics' && <Charts dailyMetrics={dailyMetrics} videos={videos} />}
        {activeView === 'content' && <ContentAnalysis videos={videos} />}
        {activeView === 'csv' && (
          <CsvImport
            onDailyMetrics={setDailyMetrics}
            onVideoMetrics={handleVideoMetrics}
            currentDaily={dailyMetrics}
            currentVideoCount={videos.length}
          />
        )}
        {activeView === 'settings' && (
          <Settings
            onFetch={handleFetch}
            loading={loading}
            error={error}
          />
        )}
      </main>
    </div>
  );
}
