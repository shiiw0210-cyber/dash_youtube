import { BarChart2, Video, TrendingUp, Upload, Settings, Youtube, type LucideIcon } from 'lucide-react';
import type { ActiveView } from '../types';

interface Props {
  active: ActiveView;
  onChange: (v: ActiveView) => void;
  channelTitle?: string;
  thumbnailUrl?: string;
}

const ITEMS: { id: ActiveView; label: string; Icon: LucideIcon }[] = [
  { id: 'overview', label: 'ダッシュボード', Icon: BarChart2 },
  { id: 'videos', label: '動画一覧', Icon: Video },
  { id: 'analytics', label: '推移グラフ', Icon: TrendingUp },
  { id: 'csv', label: 'CSVインポート', Icon: Upload },
  { id: 'settings', label: '設定', Icon: Settings },
];

export function Sidebar({ active, onChange, channelTitle, thumbnailUrl }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Youtube size={28} color="#FF0000" />
        <span className="sidebar-title">YouTube Analytics</span>
      </div>

      {channelTitle && (
        <div className="sidebar-channel">
          {thumbnailUrl && <img src={thumbnailUrl} alt="channel" className="channel-thumb" />}
          <span className="channel-name">{channelTitle}</span>
        </div>
      )}

      <nav className="sidebar-nav">
        {ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item ${active === id ? 'nav-item--active' : ''}`}
            onClick={() => onChange(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
