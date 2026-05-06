import { useEffect, useState, useCallback } from 'react'
import { studyApi } from '../../services/api'
import Button from '../../components/Button'
import { Download, RefreshCw } from 'lucide-react'

const EXPERIMENT_LABELS = {
  treasure_hunt: 'Treasure Hunt',
  career_choice: 'Career Choice',
  pattern_memory: 'Pattern Memory',
}

export default function ResearchStudies() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await studyApi.stats()
      setStats(data.stats)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = 'Research Studies - Admin'
    fetchStats()
  }, [fetchStats])

  const downloadCsv = async (experiment) => {
    const token = localStorage.getItem('token')
    const res = await fetch(studyApi.exportUrl(experiment), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      setError(`Failed to download ${experiment} CSV (${res.status})`)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${experiment}_responses.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-text-primary dark:text-gray-100">
            Research Studies
          </h1>
          <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
            Effort-justification studies served at <a href="/study" className="text-primary-600 dark:text-primary-400 underline">/study</a>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} loading={loading}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {!stats && loading && (
        <div className="text-text-secondary dark:text-gray-400">Loading…</div>
      )}

      {stats && (
        <div className="space-y-4">
          {Object.keys(stats).map((exp) => (
            <ExperimentCard
              key={exp}
              experiment={exp}
              data={stats[exp]}
              onDownload={() => downloadCsv(exp)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ExperimentCard({ experiment, data, onDownload }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">
            {EXPERIMENT_LABELS[experiment] || experiment}
          </h2>
          <p className="text-xs text-text-secondary dark:text-gray-500 font-mono">{experiment}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onDownload}>
          <Download size={14} />
          Download CSV
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Assigned" value={data.total_assigned} />
        <Stat label="Completed" value={data.total_completed} />
        <Stat
          label="Completion rate"
          value={data.total_assigned ? `${Math.round((data.total_completed / data.total_assigned) * 100)}%` : '—'}
        />
        <Stat label="Conditions" value={Object.keys(data.conditions).length} />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-secondary dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="pb-2 font-medium">Condition</th>
            <th className="pb-2 font-medium text-right">Assigned</th>
            <th className="pb-2 font-medium text-right">Completed</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.conditions).map(([cond, counts]) => (
            <tr key={cond} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
              <td className="py-2 font-mono text-text-primary dark:text-gray-200">{cond}</td>
              <td className="py-2 text-right text-text-primary dark:text-gray-200">{counts.assigned}</td>
              <td className="py-2 text-right text-text-primary dark:text-gray-200">{counts.completed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-organic p-3">
      <div className="text-xs text-text-secondary dark:text-gray-400">{label}</div>
      <div className="text-xl font-display font-semibold text-text-primary dark:text-gray-100">{value}</div>
    </div>
  )
}
