import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import type { DailyMetrics, VideoStats, CsvRow } from '../types';

interface Props {
  onDailyMetrics: (data: DailyMetrics[]) => void;
  onVideoMetrics: (data: Partial<VideoStats>[]) => void;
  currentDaily: DailyMetrics[];
  currentVideoCount: number;
}

type ImportStatus = { type: 'success' | 'error'; message: string } | null;

function parseDaily(rows: CsvRow[]): DailyMetrics[] {
  return rows
    .filter((r) => r['日付'] || r['Date'])
    .map((r) => ({
      date: r['日付'] ?? r['Date'] ?? '',
      views: parseInt(r['視聴回数'] ?? r['Views'] ?? '0') || 0,
      watchTimeMinutes: parseFloat(r['視聴時間（時間）'] ?? r['Watch time (hours)'] ?? '0') * 60 || 0,
      subscribers:
        parseInt(r['チャンネル登録者数増減'] ?? r['Subscribers'] ?? '0') || 0,
      revenue: parseFloat(r['収益（USD）'] ?? r['Revenue (USD)'] ?? '0') || 0,
    }))
    .filter((r) => r.date);
}

function parseVideoMetrics(rows: CsvRow[]): Partial<VideoStats>[] {
  return rows
    .filter((r) => r['動画タイトル'] || r['Video title'])
    .map((r) => ({
      title: r['動画タイトル'] ?? r['Video title'] ?? '',
      viewCount: parseInt(r['視聴回数'] ?? r['Views'] ?? '0') || 0,
      watchTimeMinutes:
        parseFloat(r['視聴時間（時間）'] ?? r['Watch time (hours)'] ?? '0') * 60 || 0,
      impressions: parseInt(r['インプレッション数'] ?? r['Impressions'] ?? '0') || 0,
      ctr:
        parseFloat(
          (r['インプレッションのクリック率'] ?? r['Impressions click-through rate (%)'] ?? '0').replace('%', '')
        ) / 100 || 0,
      averageViewDuration:
        parseInt(r['平均視聴時間'] ?? r['Average view duration'] ?? '0') || 0,
    }));
}

export function CsvImport({ onDailyMetrics, onVideoMetrics, currentDaily, currentVideoCount }: Props) {
  const [status, setStatus] = useState<ImportStatus>(null);
  const dailyRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  function handleFile(
    file: File,
    parser: (rows: CsvRow[]) => unknown,
    onSuccess: (data: unknown) => void,
    label: string
  ) {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        try {
          const parsed = parser(result.data);
          onSuccess(parsed);
          setStatus({ type: 'success', message: `${label}: ${(parsed as unknown[]).length} 行を読み込みました` });
        } catch {
          setStatus({ type: 'error', message: `${label}: パースに失敗しました` });
        }
      },
      error: () => setStatus({ type: 'error', message: `${label}: ファイルの読み込みに失敗しました` }),
    });
  }

  return (
    <div className="view-container">
      <h2 className="view-title">CSV インポート</h2>

      <div className="info-banner">
        YouTube Studio の「アナリティクス」→「詳細モード」→「エクスポート」からダウンロードした CSV をインポートします。
      </div>

      <div className="csv-grid">
        {/* 日別データ */}
        <div className="csv-card">
          <div className="csv-card-header">
            <FileText size={20} />
            <h3>日別データ（チャンネル全体）</h3>
          </div>
          <p className="csv-desc">
            視聴回数・視聴時間・登録者数の日別推移。<br />
            <code>コンテンツ → 日別</code> でエクスポート
          </p>
          {currentDaily.length > 0 && (
            <p className="csv-loaded">✓ {currentDaily.length} 日分のデータを読み込み済み</p>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => dailyRef.current?.click()}
          >
            <Upload size={16} /> CSV を選択
          </button>
          <input
            ref={dailyRef}
            type="file"
            accept=".csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f, parseDaily as (rows: CsvRow[]) => unknown, onDailyMetrics as (data: unknown) => void, '日別データ');
              e.target.value = '';
            }}
          />
        </div>

        {/* 動画別データ */}
        <div className="csv-card">
          <div className="csv-card-header">
            <FileText size={20} />
            <h3>動画別データ</h3>
          </div>
          <p className="csv-desc">
            動画ごとの視聴時間・インプレッション・CTR。<br />
            <code>コンテンツ → 動画</code> でエクスポート
          </p>
          {currentVideoCount > 0 && (
            <p className="csv-loaded">✓ API から {currentVideoCount} 本を取得済み</p>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => videoRef.current?.click()}
          >
            <Upload size={16} /> CSV を選択
          </button>
          <input
            ref={videoRef}
            type="file"
            accept=".csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f, parseVideoMetrics as (rows: CsvRow[]) => unknown, onVideoMetrics as (data: unknown) => void, '動画別データ');
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {status && (
        <div className={`status-message status-${status.type}`}>
          {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{status.message}</span>
        </div>
      )}

      <div className="csv-guide">
        <h3>インポート手順</h3>
        <ol>
          <li>YouTube Studio (<code>studio.youtube.com</code>) を開く</li>
          <li>左メニュー「アナリティクス」→「詳細モード」へ移動</li>
          <li>期間・指標を選択し「エクスポート」ボタンをクリック</li>
          <li>ダウンロードした CSV を上のボタンでインポート</li>
        </ol>
      </div>
    </div>
  );
}
