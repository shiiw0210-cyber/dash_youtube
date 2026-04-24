import { useState, useEffect, useCallback } from 'react';
import { Menu, Youtube, RefreshCw } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Overview } from './components/Overview';
import { VideoTable } from './components/VideoTable';
import { Charts } from './components/Charts';
import { ContentAnalysis } from './components/ContentAnalysis';
import { Alerts } from './components/Alerts';
import { CsvImport } from './components/CsvImport';
import { Settings } from './components/Settings';
import { useYouTubeApi } from './hooks/useYouTubeApi';
import type { ActiveView, ChannelStats, VideoStats, DailyMetrics } from './types';

const CHANNEL_ID = 'UCmxAaack6dmXAxwgnhzX0MQ';

export function App() {
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [channel, setChannel] = useState<ChannelStats | null>(null);
  const [videos, setVideos] = useState<VideoStats[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([]);

  const { fetchChannel, fetchVideos, loading, error } = useYouTubeApi();

  const handleFetch = useCallback(async () => {
    const [ch, vids] = await Promise.all([
      fetchChannel(CHANNEL_ID),
      fetchVideos(CHANNEL_ID),
    ]);
    if (ch) setChannel(ch);
    if (vids.length > 0) setVideos(vids);
  }, [fetchChannel, fetchVideos]);

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
    <div className="app">
      <header className="mobile-header">
        <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="メニューを開く">
          <Menu size={22} />
        </button>
        <Youtube size={22} color="#FF0000" />
        <span className="mobile-title">YouTube Analytics</span>
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
      />
      <main className="main">
        {activeView === 'overview' && <Overview channel={channel} videos={videos} />}
        {activeView === 'alerts' && <Alerts videos={videos} />}
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
