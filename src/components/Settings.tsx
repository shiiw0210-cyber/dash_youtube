import { useState } from 'react';
import { RefreshCw, ExternalLink, Send, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { loadLineConfig, saveLineConfig, sendLineTest } from '../utils/lineNotify';

interface Props {
  onFetch: () => void;
  loading: boolean;
  error: string | null;
}

export function Settings({ onFetch, loading, error }: Props) {
  const [lineToken, setLineToken] = useState(() => loadLineConfig().channelAccessToken);
  const [lineGroupId, setLineGroupId] = useState(() => loadLineConfig().groupId);
  const [lineTestStatus, setLineTestStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [lineTesting, setLineTesting] = useState(false);

  function handleLineSave() {
    saveLineConfig({ channelAccessToken: lineToken.trim(), groupId: lineGroupId.trim() });
    setLineTestStatus({ ok: true, message: '保存しました' });
  }

  async function handleLineTest() {
    saveLineConfig({ channelAccessToken: lineToken.trim(), groupId: lineGroupId.trim() });
    setLineTesting(true);
    setLineTestStatus(null);
    const result = await sendLineTest({ channelAccessToken: lineToken.trim(), groupId: lineGroupId.trim() });
    setLineTestStatus({ ok: result.ok, message: result.ok ? 'テスト送信成功！LINEを確認してください。' : `エラー: ${result.error}` });
    setLineTesting(false);
  }

  return (
    <div className="view-container">
      <h2 className="view-title">設定</h2>

      {/* YouTube API */}
      <div className="settings-card">
        <h3 className="settings-section-title">YouTube Data API v3</h3>

        <div className="info-banner" style={{ marginBottom: 20 }}>
          APIキーはサーバー環境変数（<code>YOUTUBE_API_KEY</code>）として管理されています。ブラウザには保存されません。<br />
          Vercel にデプロイする場合は、Vercel ダッシュボード → Project Settings → Environment Variables に設定してください。
          <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="label-link" style={{ marginLeft: 8 }}>
            <ExternalLink size={12} /> Google Cloud Console
          </a>
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onFetch} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {loading ? '読み込み中…' : 'データ更新'}
          </button>
        </div>

        {error && <div className="error-message"><strong>エラー:</strong> {error}</div>}
      </div>

      {/* LINE 通知 */}
      <div className="settings-card">
        <h3 className="settings-section-title">LINE 通知</h3>

        <div className="info-banner" style={{ marginBottom: 20 }}>
          サムネイルアラートが発生したとき、指定の LINE グループに自動通知します。<br />
          LINE Developers でチャンネルアクセストークンとグループIDを取得してください。
          <a
            href="https://developers.line.biz/ja/"
            target="_blank"
            rel="noopener noreferrer"
            className="label-link"
            style={{ marginLeft: 8 }}
          >
            <ExternalLink size={12} /> LINE Developers
          </a>
        </div>

        <div className="line-setup-steps">
          <h4>設定手順</h4>
          <ol>
            <li>LINE Developers でプロバイダーを作成 → <strong>Messaging API チャンネル</strong>を作成</li>
            <li>「チャンネル基本設定」→「チャンネルアクセストークン（長期）」を発行してコピー</li>
            <li>作成した Bot アカウントを <strong>既存のグループ LINE に招待</strong></li>
            <li>グループのトークルームを開き、グループ ID を取得（Webhook イベントログから確認可）</li>
          </ol>
        </div>

        <div className="form-group">
          <label className="form-label">チャンネルアクセストークン（長期）</label>
          <input
            type="password"
            className="form-input"
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxx..."
            value={lineToken}
            onChange={(e) => setLineToken(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">送信先グループ ID</label>
          <input
            type="text"
            className="form-input"
            placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={lineGroupId}
            onChange={(e) => setLineGroupId(e.target.value)}
          />
          <p className="form-hint">
            グループIDは <code>C</code> から始まります。取得方法は下の手順を参照してください。
          </p>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleLineSave} disabled={!lineToken || !lineGroupId}>
            <Save size={16} /> 保存
          </button>
          <button className="btn btn-secondary" onClick={handleLineTest} disabled={lineTesting || !lineToken || !lineGroupId}>
            <Send size={16} className={lineTesting ? 'spin' : ''} />
            {lineTesting ? '送信中…' : 'テスト送信'}
          </button>
        </div>

        {lineTestStatus && (
          <div className={`status-message status-${lineTestStatus.ok ? 'success' : 'error'}`}>
            {lineTestStatus.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {lineTestStatus.message}
          </div>
        )}

        <div className="line-groupid-guide">
          <h4>グループ ID の取得方法</h4>
          <ol>
            <li>LINE Developers の Messaging API チャンネル → 「Webhook URL」を設定（例：<code>https://your-server/webhook</code>）</li>
            <li>グループで Bot にメッセージを送ると Webhook に <code>source.groupId</code> が届く</li>
            <li>または <a href="https://github.com/line/line-bot-sdk-nodejs" target="_blank" rel="noopener noreferrer">ngrok</a> を使ってローカルで一時的に受信して確認</li>
          </ol>
          <p className="form-hint" style={{ marginTop: 8 }}>
            ※ 簡単な方法：Bot をグループに招待後、グループで「グループID」と送ると自動返信するシンプルな Webhook を一時的に立てる方法もあります。
          </p>
        </div>
      </div>

      {/* YouTube Analytics OAuth */}
      <div className="settings-card">
        <h3 className="settings-section-title">YouTube Analytics（OAuth 連携）</h3>
        <div className="info-banner" style={{ marginBottom: 16 }}>
          インプレッション・CTR・視聴維持率・推定収益を YouTube Analytics API から自動取得します。
          初回のみ以下の手順で <code>refresh_token</code> を取得し、Vercel 環境変数に登録してください。
          <a
            href="https://developers.google.com/youtube/analytics/reference/reports/query"
            target="_blank"
            rel="noopener noreferrer"
            className="label-link"
            style={{ marginLeft: 8 }}
          >
            <ExternalLink size={12} /> Analytics API ドキュメント
          </a>
        </div>

        <div className="line-setup-steps">
          <h4>セットアップ手順（初回のみ・約5分）</h4>
          <ol>
            <li>
              <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">
                Google Cloud Console
              </a>
              → APIs &amp; Services → Library で <strong>「YouTube Analytics API」</strong> を有効化
            </li>
            <li>
              Credentials → Create Credentials →{' '}
              <strong>OAuth client ID</strong> を作成
              <ul>
                <li>Application type: <code>Web application</code></li>
                <li>
                  Authorized redirect URIs:{' '}
                  <code>https://developers.google.com/oauthplayground</code>
                </li>
              </ul>
            </li>
            <li>発行された <strong>Client ID</strong> と <strong>Client Secret</strong> をメモ</li>
            <li>
              <a
                href="https://developers.google.com/oauthplayground/"
                target="_blank"
                rel="noopener noreferrer"
              >
                OAuth 2.0 Playground
              </a>{' '}
              を開く → 右上ギア ⚙ → <strong>Use your own OAuth credentials</strong> にチェック →
              Client ID / Secret を貼り付け
            </li>
            <li>
              左欄に以下のスコープを入力して <strong>Authorize APIs</strong>:
              <ul>
                <li>
                  <code>https://www.googleapis.com/auth/yt-analytics.readonly</code>
                </li>
                <li>
                  <code>https://www.googleapis.com/auth/yt-analytics-monetary.readonly</code>
                </li>
              </ul>
            </li>
            <li>
              自分の YouTube アカウントで承認 → <strong>Exchange authorization code for tokens</strong> をクリック
            </li>
            <li>
              表示された <strong>Refresh token</strong> をコピー（一度しか表示されない場合があるので注意）
            </li>
            <li>
              Vercel ダッシュボード → Project Settings → Environment Variables に以下を登録し、再デプロイ:
              <ul>
                <li><code>GOOGLE_OAUTH_CLIENT_ID</code></li>
                <li><code>GOOGLE_OAUTH_CLIENT_SECRET</code></li>
                <li><code>GOOGLE_OAUTH_REFRESH_TOKEN</code></li>
              </ul>
            </li>
            <li>
              ダッシュボードで「データ更新」ボタンを押し、Analytics データが自動反映されることを確認
            </li>
          </ol>
        </div>

        <p className="form-hint" style={{ marginTop: 12 }}>
          ※ 収益が <code>—</code> と表示される場合、チャンネルが YouTube パートナープログラム未参加か、
          <code>yt-analytics-monetary.readonly</code> スコープが認可されていない可能性があります。
        </p>
      </div>

      {/* ローカルストレージ */}
      <div className="settings-card">
        <h3 className="settings-section-title">プライバシー</h3>
        <p className="form-hint">
          チャンネル ID および LINE トークンはブラウザのローカルストレージに保存されます。
          YouTube APIキー・OAuth クレデンシャル・LINE サーバー送信用トークンはすべてサーバー側の環境変数で管理され、ブラウザには保存されません。
        </p>
      </div>
    </div>
  );
}
