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

export const CONDITION_LABELS = {
  BASELINE: 'Baseline',
  HIGH_EFFORT: 'High effort',
  NR_PATTERN: 'N→R pattern',
  RN_PATTERN: 'R→N pattern',
  RANDOM: 'Random',
  WITHIN_SUBJECTS: 'Within-subjects',
}

export const displayCondition = (cond) => CONDITION_LABELS[cond] || cond

const DROP_THRESHOLD = 0.4

// Returns { dropPct, stepName } for the largest single-step drop, or null if
// no drop exceeds DROP_THRESHOLD.
export function largestDrop(row) {
  const steps = [
    { label: 'landed→consented', from: row.landed, to: row.consented },
    { label: 'consented→responded', from: row.consented, to: row.responded },
    { label: 'responded→demographics', from: row.responded, to: row.demographics },
    { label: 'demographics→completed', from: row.demographics, to: row.completed },
  ]
  let worst = null
  for (const step of steps) {
    if (!step.from) continue
    const drop = (step.from - step.to) / step.from
    if (drop > DROP_THRESHOLD && (!worst || drop > worst.dropPct)) {
      worst = { dropPct: drop, stepName: step.label }
    }
  }
  return worst
}

export default function ResearchStudies() {
  const [stats, setStats] = useState(null)
  const [activeSlug, setActiveSlug] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await studyApi.stats()
      setStats(data.stats)
      setActiveSlug(data.study?.slug || null)
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

      {activeSlug && (
        <>
          <LimitHitsCard slug={activeSlug} />
          <FunnelCard slug={activeSlug} />
        </>
      )}
      <VerifyCompletionCode />
      <RecentParticipants />
    </div>
  )
}

// Per-condition funnel. Renders as a plain table because over-engineering a
// stacked bar chart for five integers is more code than insight. Dropoff
// percent columns make the "where do they leak?" question read at a glance.
function FunnelCard({ slug }) {
  const [funnel, setFunnel] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await studyApi.funnel(slug)
      setFunnel(data.funnel)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load funnel')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  const pct = (num, den) => {
    if (!den) return '—'
    return `${Math.round((num / den) * 100)}%`
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">
            Funnel
          </h2>
          <p className="text-xs text-text-secondary dark:text-gray-500 mt-0.5">
            Landed → consented → responded → demographics → completed, per condition.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} loading={loading}>
          <RefreshCw size={14} />
        </Button>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {funnel && funnel.length > 0 && (() => {
        const totalLanded = funnel.reduce((s, r) => s + (r.landed || 0), 0)
        const totalCompleted = funnel.reduce((s, r) => s + (r.completed || 0), 0)
        const flaggedCount = funnel.filter((r) => largestDrop(r) !== null).length
        const completionPct = totalLanded ? Math.round((totalCompleted / totalLanded) * 100) : 0
        return (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg flex flex-wrap items-center gap-3">
            <span className="text-xl font-display font-bold text-text-primary dark:text-gray-100">
              {completionPct}%
            </span>
            <span className="text-sm text-text-secondary dark:text-gray-400">
              ({totalCompleted}/{totalLanded}) completed overall
            </span>
            {flaggedCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                {flaggedCount} drop{flaggedCount !== 1 ? 's' : ''} flagged
              </span>
            )}
          </div>
        )
      })()}

      {funnel && funnel.length === 0 && !loading ? (
        <p className="text-sm text-text-secondary dark:text-gray-500">No assignments yet.</p>
      ) : funnel && funnel.length > 0 ? (
        <div className="space-y-2">
          {/* Column headers — hidden on mobile, visible sm+ */}
          <div className="hidden sm:flex text-xs font-medium text-text-secondary dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-2">
            <div className="flex-1 min-w-0">Experiment / Condition</div>
            <div className="w-16 text-right">Landed</div>
            <div className="w-20 text-right">Consented</div>
            <div className="w-20 text-right">Responded</div>
            <div className="w-24 text-right">Demographics</div>
            <div className="w-20 text-right">Completed</div>
            <div className="w-20 text-right">Rate</div>
          </div>
          {funnel.map((row) => {
            const drop = largestDrop(row)
            const dropPctDisplay = drop ? Math.round(drop.dropPct * 100) : null
            return (
              <div
                key={`${row.experiment}-${row.condition}`}
                className={`rounded-lg border px-3 py-2 ${drop ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'border-gray-100 dark:border-gray-700/50'}`}
              >
                {/* Label row — always visible */}
                <div className="flex flex-wrap items-center gap-2 mb-1 sm:mb-0">
                  <span className="text-sm font-medium text-text-primary dark:text-gray-100">
                    {EXPERIMENT_LABELS[row.experiment] || row.experiment}
                  </span>
                  <span className="text-xs text-text-secondary dark:text-gray-400">
                    / {displayCondition(row.condition)}
                  </span>
                  {drop && (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-200">
                      ↓ {dropPctDisplay}% drop at {drop.stepName}
                    </span>
                  )}
                </div>

                {/* Stage counts: stacked on mobile, inline on sm+ */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 mt-1 sm:mt-0">
                  <div className="flex sm:hidden flex-col gap-0.5 text-xs text-text-secondary dark:text-gray-400">
                    <span>Landed: <span className="tabular-nums font-medium text-text-primary dark:text-gray-200">{row.landed}</span></span>
                    <span>Consented: <span className="tabular-nums font-medium text-text-primary dark:text-gray-200">{row.consented} ({pct(row.consented, row.landed)})</span></span>
                    <span>Responded: <span className="tabular-nums font-medium text-text-primary dark:text-gray-200">{row.responded} ({pct(row.responded, row.landed)})</span></span>
                    <span>Demographics: <span className="tabular-nums font-medium text-text-primary dark:text-gray-200">{row.demographics} ({pct(row.demographics, row.landed)})</span></span>
                    <span>Completed: <span className="tabular-nums font-medium text-text-primary dark:text-gray-200">{row.completed} ({pct(row.completed, row.landed)})</span></span>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center">
                    {/* spacer to align with header label column */}
                  </div>
                  <div className="hidden sm:block w-16 text-right tabular-nums text-sm text-text-primary dark:text-gray-200">{row.landed}</div>
                  <div className="hidden sm:block w-20 text-right tabular-nums text-sm text-text-primary dark:text-gray-200">
                    {row.consented}
                    <span className="text-text-secondary dark:text-gray-500 text-xs ml-1">({pct(row.consented, row.landed)})</span>
                  </div>
                  <div className="hidden sm:block w-20 text-right tabular-nums text-sm text-text-primary dark:text-gray-200">
                    {row.responded}
                    <span className="text-text-secondary dark:text-gray-500 text-xs ml-1">({pct(row.responded, row.landed)})</span>
                  </div>
                  <div className="hidden sm:block w-24 text-right tabular-nums text-sm text-text-primary dark:text-gray-200">
                    {row.demographics}
                    <span className="text-text-secondary dark:text-gray-500 text-xs ml-1">({pct(row.demographics, row.landed)})</span>
                  </div>
                  <div className="hidden sm:block w-20 text-right tabular-nums text-sm text-text-primary dark:text-gray-200">
                    {row.completed}
                    <span className="text-text-secondary dark:text-gray-500 text-xs ml-1">({pct(row.completed, row.landed)})</span>
                  </div>
                  <div className="hidden sm:block w-20 text-right tabular-nums text-sm font-medium text-text-primary dark:text-gray-200">
                    {pct(row.completed, row.landed)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

// Two-counter card showing today's 429s. Resets on backend restart — that's
// fine because this is a launch-day "is anything misbehaving" surface, not a
// long-term log.
function LimitHitsCard({ slug }) {
  const [hits, setHits] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await studyApi.limitHits(slug)
      setHits(data.limit_hits_today)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load limit hits')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  const total = hits ? (hits.payload_too_big + hits.snapshot_cap) : 0

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">
            Limit hits today
          </h2>
          <p className="text-xs text-text-secondary dark:text-gray-500 mt-0.5">
            Counters reset on backend restart. Non-zero values are worth a look.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} loading={loading}>
          <RefreshCw size={14} />
        </Button>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Payload too big (64KB)" value={hits?.payload_too_big ?? '—'} />
        <Stat label="Snapshot cap (200)" value={hits?.snapshot_cap ?? '—'} />
        <Stat label="Total" value={hits ? total : '—'} />
      </div>
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
