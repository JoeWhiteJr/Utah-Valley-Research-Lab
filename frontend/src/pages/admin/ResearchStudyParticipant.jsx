import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { studyApi } from '../../services/api'
import { ArrowLeft, Clock, FileJson } from 'lucide-react'

export default function ResearchStudyParticipant() {
  const { participantCode } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openResponses, setOpenResponses] = useState({})

  useEffect(() => {
    document.title = `Participant ${participantCode} - Admin`
    let cancelled = false
    setLoading(true)
    studyApi
      .getParticipant(participantCode)
      .then((res) => {
        if (!cancelled) {
          setData(res.data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || 'Failed to load participant')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [participantCode])

  const toggleResponse = (id) =>
    setOpenResponses((s) => ({ ...s, [id]: !s[id] }))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link
        to="/dashboard/admin/research-studies"
        className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline mb-4"
      >
        <ArrowLeft size={14} />
        Back to Studies
      </Link>

      {loading && (
        <div className="text-text-secondary dark:text-gray-400">Loading…</div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-4">
            <h1 className="font-display font-bold text-2xl text-text-primary dark:text-gray-100 mb-1">
              {data.participant.participant_code}
            </h1>
            <p className="text-xs text-text-secondary dark:text-gray-500 mb-4">
              Created {new Date(data.participant.created_at).toLocaleString()}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Stat label="Experiment" value={data.assignment?.experiment || '—'} />
              <Stat label="Condition" value={data.assignment?.condition || '—'} />
              <Stat
                label="Consent given"
                value={data.participant.consent_given_at ? formatDateTime(data.participant.consent_given_at) : '—'}
              />
              <Stat
                label="Completed"
                value={data.participant.completed_at ? formatDateTime(data.participant.completed_at) : 'in progress'}
              />
            </div>

            <h2 className="font-display font-semibold text-base text-text-primary dark:text-gray-100 mt-4 mb-2">
              Demographics
            </h2>
            {data.participant.demographics && Object.keys(data.participant.demographics).length > 0 ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {Object.entries(data.participant.demographics).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-text-secondary dark:text-gray-400 font-mono text-xs">{k}:</dt>
                    <dd className="text-text-primary dark:text-gray-200">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-text-secondary dark:text-gray-500">Not yet submitted.</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h2 className="font-display font-semibold text-base text-text-primary dark:text-gray-100 mb-3">
              Responses ({data.responses.length})
            </h2>
            {data.responses.length === 0 ? (
              <p className="text-sm text-text-secondary dark:text-gray-500">No responses yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.responses.map((r) => (
                  <li key={r.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                    <button
                      type="button"
                      onClick={() => toggleResponse(r.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/40"
                    >
                      <span className="flex items-center gap-2">
                        {r.is_snapshot ? (
                          <Clock size={14} className="text-text-secondary dark:text-gray-500" />
                        ) : (
                          <FileJson size={14} className="text-primary-600 dark:text-primary-400" />
                        )}
                        <span className="text-text-primary dark:text-gray-200">
                          {r.is_snapshot ? 'Snapshot' : 'Final response'}
                        </span>
                        <span className="text-text-secondary dark:text-gray-500 text-xs">
                          {formatDateTime(r.submitted_at)}
                        </span>
                      </span>
                      <span className="text-xs text-text-secondary dark:text-gray-400">
                        {openResponses[r.id] ? 'hide' : 'show'}
                      </span>
                    </button>
                    {openResponses[r.id] && (
                      <pre className="text-xs px-3 py-2 bg-gray-50 dark:bg-gray-900/50 overflow-x-auto text-text-primary dark:text-gray-200 border-t border-gray-200 dark:border-gray-700 max-h-96">
                        {JSON.stringify(r.payload, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-organic p-3">
      <div className="text-xs text-text-secondary dark:text-gray-400">{label}</div>
      <div className="text-sm font-semibold text-text-primary dark:text-gray-100 break-all">{value}</div>
    </div>
  )
}

function formatDateTime(s) {
  try {
    return new Date(s).toLocaleString()
  } catch {
    return s
  }
}
