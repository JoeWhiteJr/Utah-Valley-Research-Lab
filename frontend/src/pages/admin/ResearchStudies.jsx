import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { studyApi } from '../../services/api'
import Button from '../../components/Button'
import Input from '../../components/Input'
import { Download, RefreshCw, ChevronRight, CheckCircle2, AlertCircle, XCircle, Search } from 'lucide-react'

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

      <VerifyCompletionCode />
      <RecentParticipants />
    </div>
  )
}

function VerifyCompletionCode() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const lookup = async (e) => {
    e?.preventDefault?.()
    const trimmed = code.trim()
    if (!trimmed) return
    setLoading(true)
    setResult(null)
    try {
      const { data } = await studyApi.getParticipant(trimmed)
      setResult({
        status: data.participant?.completed_at ? 'completed' : 'started',
        participant: data.participant,
        assignment: data.assignment,
      })
    } catch (err) {
      if (err.response?.status === 404) {
        setResult({ status: 'not_found' })
      } else {
        setResult({ status: 'error', message: err.response?.data?.error?.message || 'Lookup failed' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm mt-6">
      <div className="mb-3">
        <h2 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">
          Verify completion code
        </h2>
        <p className="text-xs text-text-secondary dark:text-gray-400 mt-0.5">
          Look up a code that a student submitted for extra credit.
        </p>
      </div>
      <form onSubmit={lookup} className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label=""
            type="text"
            placeholder="e.g. TH_1714234567_a1b2c3d4"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <Button type="submit" loading={loading} disabled={!code.trim()}>
          <Search size={14} />
          Look up
        </Button>
      </form>

      {result?.status === 'completed' && (
        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-organic flex items-start gap-3">
          <CheckCircle2 size={20} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-text-primary dark:text-gray-100">Verified — completed</div>
            <div className="text-text-secondary dark:text-gray-400">
              {result.assignment?.experiment} / {result.assignment?.condition} &middot; finished {new Date(result.participant.completed_at).toLocaleString()}
            </div>
            <Link
              to={`/dashboard/admin/research-studies/${result.participant.participant_code}`}
              className="text-primary-600 dark:text-primary-400 hover:underline text-xs inline-flex items-center mt-1"
            >
              View full record
              <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      )}

      {result?.status === 'started' && (
        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-organic flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-text-primary dark:text-gray-100">Started but not completed</div>
            <div className="text-text-secondary dark:text-gray-400">
              {result.assignment?.experiment} / {result.assignment?.condition} &middot; started {new Date(result.participant.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {result?.status === 'not_found' && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-organic flex items-start gap-3">
          <XCircle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-text-primary dark:text-gray-100">Code not found</div>
            <div className="text-text-secondary dark:text-gray-400">
              No participant matches that code. Double-check spelling and case.
            </div>
          </div>
        </div>
      )}

      {result?.status === 'error' && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-organic text-sm text-red-700 dark:text-red-400">
          {result.message}
        </div>
      )}
    </div>
  )
}

function RecentParticipants() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [experimentFilter, setExperimentFilter] = useState('')
  const [completedFilter, setCompletedFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { limit: 50 }
      if (experimentFilter) params.experiment = experimentFilter
      if (completedFilter !== 'all') params.completed = completedFilter
      const { data } = await studyApi.listParticipants(params)
      setRows(data.participants)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load participants')
    } finally {
      setLoading(false)
    }
  }, [experimentFilter, completedFilter])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">
          Recent participants
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={experimentFilter}
            onChange={(e) => setExperimentFilter(e.target.value)}
            className="text-sm rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-text-primary dark:text-gray-100 px-2 py-1"
          >
            <option value="">All experiments</option>
            <option value="treasure_hunt">Treasure Hunt</option>
            <option value="career_choice">Career Choice</option>
            <option value="pattern_memory">Pattern Memory</option>
          </select>
          <select
            value={completedFilter}
            onChange={(e) => setCompletedFilter(e.target.value)}
            className="text-sm rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-text-primary dark:text-gray-100 px-2 py-1"
          >
            <option value="all">All</option>
            <option value="true">Completed only</option>
            <option value="false">In progress</option>
          </select>
          <Button variant="outline" size="sm" onClick={load} loading={loading}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {rows.length === 0 && !loading ? (
        <p className="text-sm text-text-secondary dark:text-gray-500">No participants match.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="pb-2 font-medium">Code</th>
              <th className="pb-2 font-medium">Experiment</th>
              <th className="pb-2 font-medium">Condition</th>
              <th className="pb-2 font-medium">Started</th>
              <th className="pb-2 font-medium">Completed</th>
              <th className="pb-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.participant_code} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <td className="py-2 font-mono text-xs text-text-primary dark:text-gray-200">
                  {row.participant_code}
                </td>
                <td className="py-2 font-mono text-xs text-text-primary dark:text-gray-200">{row.experiment}</td>
                <td className="py-2 font-mono text-xs text-text-primary dark:text-gray-200">{row.condition}</td>
                <td className="py-2 text-xs text-text-secondary dark:text-gray-400">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="py-2 text-xs text-text-secondary dark:text-gray-400">
                  {row.completed_at ? new Date(row.completed_at).toLocaleString() : '—'}
                </td>
                <td className="py-2 text-right">
                  <Link
                    to={`/dashboard/admin/research-studies/${row.participant_code}`}
                    className="inline-flex items-center text-primary-600 dark:text-primary-400 hover:underline text-xs"
                  >
                    View
                    <ChevronRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
            <th className="pb-2 font-medium">Progress</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.conditions).map(([cond, counts]) => (
            <tr key={cond} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
              <td className="py-2 font-mono text-text-primary dark:text-gray-200">{cond}</td>
              <td className="py-2 text-right text-text-primary dark:text-gray-200">{counts.assigned}</td>
              <td className="py-2 text-right text-text-primary dark:text-gray-200">{counts.completed}</td>
              <td className="py-2 w-1/3">
                <ConditionProgress counts={counts} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Renders nothing if the study has no recruitment target. Otherwise: a thin
// progress bar plus a status pill (on track / near complete / met / over).
function ConditionProgress({ counts }) {
  if (!counts.target) {
    return <span className="text-text-secondary dark:text-gray-500 text-xs">—</span>
  }
  const pct = Math.min(counts.progress_pct ?? 0, 120)
  const status = counts.status || 'on_track'
  const barColor =
    status === 'over' ? 'bg-amber-500'
    : status === 'met' ? 'bg-emerald-500'
    : status === 'near_complete' ? 'bg-emerald-400'
    : 'bg-primary-500'
  const pillClass =
    status === 'over' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
    : status === 'met' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
    : status === 'near_complete' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  const pillLabel =
    status === 'over' ? 'Over target — stop recruiting'
    : status === 'met' ? 'Target met'
    : status === 'near_complete' ? 'Nearly complete'
    : 'On track'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary dark:text-gray-400 tabular-nums whitespace-nowrap">
        {counts.completed}/{counts.target}
      </span>
      <span className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap ${pillClass}`}>
        {pillLabel}
      </span>
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
