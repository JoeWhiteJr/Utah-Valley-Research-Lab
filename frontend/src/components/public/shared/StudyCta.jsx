// Homepage call-to-action that surfaces the most recent active research study.
// Fetches from the public /api/study/list and hides itself entirely when no
// study is active or the request fails (e.g. backend offline).

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FlaskConical, Clock, ShieldCheck } from 'lucide-react'
import { studyApi } from '../../../services/api'

export default function StudyCta() {
  const [study, setStudy] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    studyApi
      .listActiveStudies()
      .then((res) => {
        if (cancelled) return
        const first = res.data?.studies?.[0] || null
        setStudy(first)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Hide the section while loading and when no study is available, so we don't
  // flash an empty card or a misleading "study coming soon" message.
  if (!loaded || !study) return null

  return (
    <section className="py-20 bg-gradient-to-br from-emerald-50 via-white to-pub-blue-50 border-y border-emerald-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-5 gap-0">
            {/* Left accent panel */}
            <div className="md:col-span-2 bg-gradient-to-br from-pub-blue-600 to-pub-blue-800 p-8 md:p-10 flex flex-col justify-center">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 inline-flex items-center justify-center w-16 h-16 mb-4">
                <FlaskConical className="w-8 h-8 text-white" />
              </div>
              <p className="text-white/80 text-sm uppercase tracking-wide font-semibold mb-2">
                Help our research
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                Take our most recent study
              </h2>
            </div>

            {/* Right content panel */}
            <div className="md:col-span-3 p-8 md:p-10 flex flex-col justify-center">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                {study.title}
              </h3>
              {study.blurb && (
                <p className="text-gray-600 mb-4 leading-relaxed">{study.blurb}</p>
              )}
              <div className="flex flex-wrap gap-4 mb-6 text-sm text-gray-600">
                {study.estimated_minutes && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-pub-blue-600" />
                    About {study.estimated_minutes} minutes
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Anonymous — no account needed
                </span>
              </div>
              <Link
                to="/study"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors w-full sm:w-auto"
              >
                Participate now
                <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-xs text-gray-500 mt-3">
                You can stop at any time. Your responses are stored without your
                name or email.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
