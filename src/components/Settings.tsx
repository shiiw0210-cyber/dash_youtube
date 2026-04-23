import { useState } from 'react';
import { Save, RefreshCw, ExternalLink } from 'lucide-react';

interface Props {
  apiKey: string;
  channelId: string;
  onSave: (apiKey: string, channelId: string) => void;
  onFetch: () => void;
  loading: boolean;
  error: string | null;
}

export function Settings({ apiKey, channelId, onSave, onFetch, loading, error }: Props) {
  const [localKey, setLocalKey] = useState(apiKey);
  const [localChannel, setLocalChannel] = useState(channelId);

  function handleSave() {
    onSave(localKey.trim(), localChannel.trim());
  }

  return (
    <div className="view-container">
      <h2 className="view-title">設定</h2>

      <div className="settings-card">
        <h3 className="settings-section-title">YouTube Data API v3</h3>

        <div className="form-group">
          <label className="form-label">
            API キー
            <a
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="label-link"
            >
              <ExternalLink size={12} /> Google Cloud Console
            </a>
          </label>
          <input
            type="password"
            className="form-input"
            placeholder="AIza..."
            value={localKey}
            onChange={(e) => setLocalKey(e.target.value)}
          />
          <p className="form-hint">
            Google Cloud Console で YouTube Data API v3 を有効化し、APIキーを発行してください。
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">チャンネル ID</label>
          <input
            type="text"
            className="form-input"
            placeholder="UCxxxxxxxxxxxxxxxxxxxxxxxx"
            value={localChannel}
            onChange={(e) => setLocalChannel(e.target.value)}
          />
          <p className="form-hint">
            YouTube Studio → 設定 → チャンネル → 基本情報 からコピーできます。
          </p>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} /> 保存
          </button>
          <button
            className="btn btn-secondary"
            onClick={onFetch}
            disabled={loading || !localKey || !localChannel}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {loading ? '読み込み中…' : 'データ更新'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <strong>エラー:</strong> {error}
          </div>
        )}
      </div>

      <div className="settings-card">
        <h3 className="settings-section-title">ローカルストレージ</h3>
        <p className="form-hint">
          API キーとチャンネル ID はブラウザのローカルストレージに保存されます。
          外部サーバーには送信されません。
        </p>
      </div>
    </div>
  );
}
