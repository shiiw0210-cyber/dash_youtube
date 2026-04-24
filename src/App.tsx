import { useState, useEffect, useCallback } from 'react';
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

const STORAGE_KEY_CH = 'yt_dash_channel_id';

export function App() {
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [channelId, setChannelId] = useState(() => localStorage.getItem(STORAGE_KEY_CH) ?? 'UCmxAaack6dmXAxwgnhzX0MQ');
  const [channel, setChannel] = useState<ChannelStats | null>(null);
  const [videos, setVideos] = useState<VideoStats[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([]);

  const { fetchChannel, fetchVideos, loading, error } = useYouTubeApi();

  function handleSaveSettings(chId: string) {
    setChannelId(chId);
    localStorage.setItem(STORAGE_KEY_CH, chId);
  }

  const handleFetch = useCallback(async () => {
    if (!channelId) return;
    const [ch, vids] = await Promise.all([
      fetchChannel(channelId),
      fetchVideos(channelId),
    ]);
    if (ch) setChannel(ch);
    if (vids.length > 0) setVideos(vids);
  }, [channelId, fetchChannel, fetchVideos]);

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
    if (channelId) handleFetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <Sidebar
        active={activeView}
        onChange={setActiveView}
        channelTitle={channel?.channelTitle}
        thumbnailUrl={channel?.thumbnailUrl}
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
            channelId={channelId}
            onSave={handleSaveSettings}
            onFetch={handleFetch}
            loading={loading}
            error={error}
          />
        )}
      </main>
    </div>
  );
}
