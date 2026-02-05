const colorSchemes = {
  primary: 'from-primary-400 to-primary-500',
  secondary: 'from-secondary-400 to-secondary-500',
  accent: 'from-accent-400 to-accent-500',
  success: 'from-green-400 to-green-500',
  danger: 'from-red-400 to-red-500',
}

const heights = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
}

export default function ProgressBar({
  value = 0,
  label,
  showValue = false,
  color = 'primary',
  size = 'md',
  className = '',
}) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs mb-1.5">
          {label && <span className="text-text-secondary">{label}</span>}
          {showValue && (
            <span className="font-medium text-text-primary">{Math.round(clamped)}%</span>
          )}
        </div>
      )}
      <div className={`${heights[size]} bg-gray-100 rounded-full overflow-hidden`}>
        <div
          className={`h-full bg-gradient-to-r ${colorSchemes[color]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
