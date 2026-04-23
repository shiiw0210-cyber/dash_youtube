interface Props {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  icon: React.ReactNode;
  color: string;
}

export function StatCard({ label, value, sub, trend, icon, color }: Props) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: color + '1a', color }}>
        {icon}
      </div>
      <div className="stat-body">
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {sub && <p className="stat-sub">{sub}</p>}
        {trend !== undefined && (
          <p className={`stat-trend ${trend >= 0 ? 'trend-up' : 'trend-down'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  );
}
