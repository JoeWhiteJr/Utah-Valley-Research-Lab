export default function Tabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`flex gap-1 border-b border-gray-200 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${
                isActive
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
              }
            `}
          >
            {Icon && <Icon size={16} />}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`
                  ml-1 px-1.5 py-0.5 rounded-full text-xs
                  ${isActive ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-text-secondary'}
                `}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
