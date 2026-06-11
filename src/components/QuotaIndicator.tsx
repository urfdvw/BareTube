import { getQuota } from '../lib/storage';

interface Props {
  refresh?: number;
}

const DAILY = 10000;

export default function QuotaIndicator({ refresh }: Props) {
  const quota = getQuota();
  const pct = Math.min((quota.unitsUsed / DAILY) * 100, 100);
  const color = pct > 90 ? '#e53935' : pct > 70 ? '#fb8c00' : '#4caf50';

  return (
    <div className="quota-indicator" key={refresh}>
      <div className="quota-label">
        API Quota: {quota.unitsUsed.toLocaleString()} / {DAILY.toLocaleString()} units
      </div>
      <div className="quota-bar-bg">
        <div className="quota-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {pct > 90 && (
        <p className="quota-warning">Quota nearly exhausted. API calls may be blocked.</p>
      )}
    </div>
  );
}
