import { BarChart2, Calendar, Video, TrendingUp, Upload, Settings, Youtube, Lightbulb, AlertTriangle, MousePointerClick, X, Smartphone, Monitor, type LucideIcon } from 'lucide-react';
import type { ActiveView } from '../types';

interface Props {
  active: ActiveView;
  onChange: (v: ActiveView) => void;
  channelTitle?: string;
  thumbnailUrl?: string;
  isOpen?: boolean;
  onClose?: () => void;
  mobilePreview?: boolean;
  onToggleMobilePreview?: () => void;
}

const ITEMS: { id: ActiveView; label: string; Icon: LucideIcon }[] = [
  { id: 'overview', label: 'ダッシュボード', Icon: BarChart2 },
  { id: 'schedule', label: 'スケジュール', Icon: Calendar },
  { id: 'alerts', label: 'サムネアラート', Icon: AlertTriangle },
  { id: 'ctr', label: 'CTRランキング', Icon: MousePointerClick },
  { id: 'videos', label: '動画一覧', Icon: Video },
  { id: 'analytics', label: '推移グラフ', Icon: TrendingUp },
  { id: 'content', label: 'コンテンツ分析', Icon: Lightbulb },
  { id: 'csv', label: 'CSVインポート', Icon: Upload },
  { id: 'settings', label: '設定', Icon: Settings },
];

export function Sidebar({ active, onChange, channelTitle, thumbnailUrl, isOpen, onClose, mobilePreview, onToggleMobilePreview }: Props) {
  function handleNav(id: ActiveView) {
    onChange(id);
    onClose?.();
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <Youtube size={28} color="#FF0000" />
          <span className="sidebar-title">YouTube Analytics</span>
          <button className="sidebar-close" onClick={onClose} aria-label="メニューを閉じる">
            <X size={18} />
          </button>
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
              onClick={() => handleNav(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className={`view-toggle-btn${mobilePreview ? ' view-toggle-btn--active' : ''}`}
            onClick={onToggleMobilePreview}
            title={mobilePreview ? 'デスクトップ表示に切替' : 'スマホ表示に切替'}
          >
            {mobilePreview ? <Monitor size={15} /> : <Smartphone size={15} />}
            <span>{mobilePreview ? 'デスクトップ表示' : 'スマホ表示'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
