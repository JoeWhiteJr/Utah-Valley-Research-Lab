function Bone({ className = '' }) {
  return (
    <div className={`bg-gray-200 rounded-organic animate-pulse ${className}`} />
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <Bone className="h-32 rounded-none" />
      <div className="p-5 space-y-3">
        <Bone className="h-5 w-3/4" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-2/3" />
        <Bone className="h-2 w-full mt-4" />
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Bone className="w-5 h-5 rounded" />
          <Bone className="h-4 flex-1" />
          <Bone className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

export function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <Bone className="w-10 h-10 rounded-organic" />
      <div className="mt-3 space-y-2">
        <Bone className="h-7 w-16" />
        <Bone className="h-4 w-24" />
      </div>
    </div>
  )
}

export function TextSkeleton({ lines = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Bone
          key={i}
          className="h-4"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

export default { CardSkeleton, ListSkeleton, StatSkeleton, TextSkeleton }
