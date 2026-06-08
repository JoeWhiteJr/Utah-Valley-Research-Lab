// Public listing of active research studies. Future studies appear here as
// they reach status='active'. When there are no active studies, the page
// shows a friendly empty state rather than 404.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FlaskConical, Clock, ShieldCheck, MailQuestion } from 'lucide-react'
import { studyApi } from '../../../services/api'

export default function ParticipatePage() {
  const [studies, setStudies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    document.title = 'Participate in Research | UVRL'
    let cancelled = false
    studyApi
      .listActiveStudies()
      .then((res) => {
        if (cancelled) return
        setStudies(res.data?.studies || [])
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('We could not load the current studies. Please try again later.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen pt-24 pb-20 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-pub-blue-100 text-pub-blue-700 dark:bg-pub-blue-900/40 dark:text-pub-blue-300 rounded-full text-sm font-medium mb-4">
            <FlaskConical className="w-4 h-4" />
            Research Participation
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Help advance our research
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
            Anyone can participate in our active studies. Most take 10–15 minutes,
            require no account or email, and store your responses anonymously.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-gray-500 dark:text-gray-400">Loading studies&hellip;</div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && studies.length === 0 && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-10 text-center">
            <MailQuestion className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No studies are currently recruiting
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Check back soon. New studies are posted periodically.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 text-pub-blue-600 hover:text-pub-blue-700 dark:text-pub-blue-400 dark:hover:text-pub-blue-300 font-medium"
            >
              Or get in touch with the lab
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Studies list */}
        {!loading && !error && studies.length > 0 && (
          <div className="grid gap-6">
            {studies.map((study) => (
              <StudyCard key={study.slug} study={study} />
            ))}
          </div>
        )}

        {/* Participant rights footer */}
        {!loading && (
          <div className="mt-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">A few things to know before you start</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>&bull; You must be at least 18 years old to participate.</li>
              <li>&bull; Participation is voluntary. You can stop at any time by closing the tab.</li>
              <li>&bull; We do not collect your name, email, or any identifying information.</li>
              <li>
                &bull; Read our{' '}
                <Link to="/privacy" className="text-pub-blue-600 hover:underline dark:text-pub-blue-400">
                  privacy policy
                </Link>{' '}
                for the full details on how research data is stored.
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function StudyCard({ study }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="p-6 md:p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{study.title}</h2>
        {study.blurb && (
          <p className="text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">{study.blurb}</p>
        )}
        <div className="flex flex-wrap gap-4 mb-6 text-sm text-gray-600 dark:text-gray-400">
          {study.estimated_minutes && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-pub-blue-600 dark:text-pub-blue-400" />
              About {study.estimated_minutes} minutes
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Anonymous
          </span>
        </div>
        <Link
          to={`/study?slug=${encodeURIComponent(study.slug)}`}
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors"
        >
          Begin this study
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  )
}
