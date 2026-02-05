import { TrendingUp, TrendingDown } from 'lucide-react'

export default function StatCard({ icon: Icon, label, value, trend, trendLabel, className = '' }) {
  const isPositive = trend > 0

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="p-2.5 rounded-organic bg-primary-50">
          <Icon size={20} className="text-primary-500" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-display font-bold text-text-primary">{value}</p>
        <p className="text-sm text-text-secondary mt-0.5">{label}</p>
      </div>
      {trendLabel && (
        <p className="text-xs text-text-secondary mt-2">{trendLabel}</p>
      )}
    </div>
  )
}
