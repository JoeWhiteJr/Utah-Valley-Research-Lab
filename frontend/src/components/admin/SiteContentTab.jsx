import { useState, useEffect } from 'react'
import { adminApi } from '../../services/api'
import Button from '../Button'
import { ChevronDown, ChevronUp, Save, Loader2 } from 'lucide-react'

const SECTION_LABELS = {
  hero: 'Hero Section',
  stats: 'Stats',
  about: 'About',
  services: 'Services',
  contact: 'Contact Info',
  faq: 'FAQ',
  donate: 'Donate Page',
}

function JsonField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">{label}</label>
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm"
      />
    </div>
  )
}

function JsonTextarea({ label, value, onChange, rows = 3 }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">{label}</label>
      <textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm resize-none"
      />
    </div>
  )
}

function HeroEditor({ data, onChange }) {
  if (!data) return null
  return (
    <div className="space-y-3">
      <JsonField label="Title" value={data.title} onChange={(v) => onChange({ ...data, title: v })} />
      <JsonField label="Tagline" value={data.tagline} onChange={(v) => onChange({ ...data, tagline: v })} />
      <JsonTextarea label="Description" value={data.description} onChange={(v) => onChange({ ...data, description: v })} />
      <div className="grid grid-cols-2 gap-3">
        <JsonField label="Primary CTA Label" value={data.primaryCta?.label} onChange={(v) => onChange({ ...data, primaryCta: { ...data.primaryCta, label: v } })} />
        <JsonField label="Primary CTA Path" value={data.primaryCta?.path} onChange={(v) => onChange({ ...data, primaryCta: { ...data.primaryCta, path: v } })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <JsonField label="Secondary CTA Label" value={data.secondaryCta?.label} onChange={(v) => onChange({ ...data, secondaryCta: { ...data.secondaryCta, label: v } })} />
        <JsonField label="Secondary CTA Path" value={data.secondaryCta?.path} onChange={(v) => onChange({ ...data, secondaryCta: { ...data.secondaryCta, path: v } })} />
      </div>
    </div>
  )
}

function StatsEditor({ data, onChange }) {
  if (!Array.isArray(data)) return null
  const update = (index, field, value) => {
    const updated = [...data]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }
  const addStat = () => onChange([...data, { number: '0', label: 'New Stat' }])
  const removeStat = (index) => onChange(data.filter((_, i) => i !== index))

  return (
    <div className="space-y-3">
      {data.map((stat, i) => (
        <div key={i} className="flex gap-3 items-end">
          <div className="flex-1">
            <JsonField label={`Stat ${i + 1} Number`} value={stat.number} onChange={(v) => update(i, 'number', v)} />
          </div>
          <div className="flex-1">
            <JsonField label="Label" value={stat.label} onChange={(v) => update(i, 'label', v)} />
          </div>
          <button onClick={() => removeStat(i)} className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-sm mb-0.5">Remove</button>
        </div>
      ))}
      <button onClick={addStat} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">+ Add stat</button>
    </div>
  )
}

function AboutEditor({ data, onChange }) {
  if (!data) return null
  const updateHighlights = (index, value) => {
    const highlights = [...(data.highlights || [])]
    highlights[index] = value
    onChange({ ...data, highlights })
  }
  return (
    <div className="space-y-3">
      <JsonField label="Label" value={data.label} onChange={(v) => onChange({ ...data, label: v })} />
      <JsonField label="Title" value={data.title} onChange={(v) => onChange({ ...data, title: v })} />
      <JsonTextarea label="Description" value={data.description} onChange={(v) => onChange({ ...data, description: v })} />
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">Highlights</label>
        {(data.highlights || []).map((h, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text"
              value={h}
              onChange={(e) => updateHighlights(i, e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <button onClick={() => onChange({ ...data, highlights: data.highlights.filter((_, idx) => idx !== i) })} className="text-red-500 text-sm px-2">Remove</button>
          </div>
        ))}
        <button onClick={() => onChange({ ...data, highlights: [...(data.highlights || []), ''] })} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">+ Add highlight</button>
      </div>
    </div>
  )
}

function ContactEditor({ data, onChange }) {
  if (!data) return null
  return (
    <div className="space-y-3">
      <JsonField label="Email" value={data.email} onChange={(v) => onChange({ ...data, email: v })} />
      <div className="grid grid-cols-2 gap-3">
        <JsonField label="Phone" value={data.phone} onChange={(v) => onChange({ ...data, phone: v })} />
        <JsonField label="Phone Raw" value={data.phoneRaw} onChange={(v) => onChange({ ...data, phoneRaw: v })} />
      </div>
      <JsonField label="Address" value={data.address} onChange={(v) => onChange({ ...data, address: v })} />
      <div className="grid grid-cols-3 gap-3">
        <JsonField label="City" value={data.city} onChange={(v) => onChange({ ...data, city: v })} />
        <JsonField label="State" value={data.state} onChange={(v) => onChange({ ...data, state: v })} />
        <JsonField label="ZIP" value={data.zip} onChange={(v) => onChange({ ...data, zip: v })} />
      </div>
      <JsonField label="Office Hours" value={data.officeHours} onChange={(v) => onChange({ ...data, officeHours: v })} />
      <JsonField label="Google Maps URL" value={data.googleMapsUrl} onChange={(v) => onChange({ ...data, googleMapsUrl: v })} />
    </div>
  )
}

function FaqEditor({ data, onChange }) {
  if (!Array.isArray(data)) return null
  const update = (index, field, value) => {
    const updated = [...data]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }
  return (
    <div className="space-y-4">
      {data.map((faq, i) => (
        <div key={i} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
          <JsonField label={`Question ${i + 1}`} value={faq.question} onChange={(v) => update(i, 'question', v)} />
          <JsonTextarea label="Answer" value={faq.answer} onChange={(v) => update(i, 'answer', v)} rows={2} />
          <button onClick={() => onChange(data.filter((_, idx) => idx !== i))} className="text-red-500 text-sm hover:underline">Remove Q&A</button>
        </div>
      ))}
      <button onClick={() => onChange([...data, { question: '', answer: '' }])} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">+ Add Q&A pair</button>
    </div>
  )
}

function DonateEditor({ data, onChange }) {
  if (!data) return null
  return (
    <div className="space-y-3">
      <JsonField label="Hero Title" value={data.hero?.title} onChange={(v) => onChange({ ...data, hero: { ...data.hero, title: v } })} />
      <JsonField label="Hero Subtitle" value={data.hero?.subtitle} onChange={(v) => onChange({ ...data, hero: { ...data.hero, subtitle: v } })} />
      <JsonField label="Intro Title" value={data.intro?.title} onChange={(v) => onChange({ ...data, intro: { ...data.intro, title: v } })} />
      <JsonTextarea label="Intro Lead" value={data.intro?.lead} onChange={(v) => onChange({ ...data, intro: { ...data.intro, lead: v } })} />
    </div>
  )
}

function ServicesEditor({ data, onChange }) {
  if (!Array.isArray(data)) return null
  const update = (index, field, value) => {
    const updated = [...data]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }
  return (
    <div className="space-y-4">
      {data.map((svc, i) => (
        <div key={i} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <JsonField label="Icon" value={svc.icon} onChange={(v) => update(i, 'icon', v)} />
            <JsonField label="Title" value={svc.title} onChange={(v) => update(i, 'title', v)} />
          </div>
          <JsonTextarea label="Description" value={svc.description} onChange={(v) => update(i, 'description', v)} rows={2} />
          <button onClick={() => onChange(data.filter((_, idx) => idx !== i))} className="text-red-500 text-sm hover:underline">Remove</button>
        </div>
      ))}
      <button onClick={() => onChange([...data, { icon: 'BarChart3', title: '', description: '' }])} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">+ Add service</button>
    </div>
  )
}

function RawJsonEditor({ data, onChange }) {
  const [text, setText] = useState(JSON.stringify(data, null, 2))
  const [error, setError] = useState(null)

  useEffect(() => {
    setText(JSON.stringify(data, null, 2))
  }, [data])

  const handleBlur = () => {
    try {
      const parsed = JSON.parse(text)
      onChange(parsed)
      setError(null)
    } catch {
      setError('Invalid JSON')
    }
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        rows={10}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary-300 resize-y"
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

function SectionEditor({ sectionKey, keyName, data, onChange }) {
  // Pick the right sub-editor
  if (sectionKey === 'hero' && keyName === 'main') return <HeroEditor data={data} onChange={onChange} />
  if (sectionKey === 'stats' && keyName === 'main') return <StatsEditor data={data} onChange={onChange} />
  if (sectionKey === 'about' && keyName === 'summary') return <AboutEditor data={data} onChange={onChange} />
  if (sectionKey === 'contact' && keyName === 'main') return <ContactEditor data={data} onChange={onChange} />
  if (sectionKey === 'faq' && keyName === 'main') return <FaqEditor data={data} onChange={onChange} />
  if (sectionKey === 'donate' && keyName === 'main') return <DonateEditor data={data} onChange={onChange} />
  if (sectionKey === 'services' && keyName === 'main') return <ServicesEditor data={data} onChange={onChange} />
  // Fallback to raw JSON editor
  return <RawJsonEditor data={data} onChange={onChange} />
}

export default function SiteContentTab() {
  const [sections, setSections] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [expanded, setExpanded] = useState({})
  const [edited, setEdited] = useState({})
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadContent()
  }, [])

  const loadContent = async () => {
    setLoading(true)
    try {
      const { data } = await adminApi.getAllSiteContent()
      setSections(data.sections)
      // Initialize edited state from loaded data
      const initial = {}
      for (const [section, keys] of Object.entries(data.sections)) {
        for (const [key, entry] of Object.entries(keys)) {
          initial[`${section}:${key}`] = entry.value
        }
      }
      setEdited(initial)
    } catch {
      setMessage({ type: 'error', text: 'Failed to load site content' })
    }
    setLoading(false)
  }

  const handleSave = async (section, key) => {
    const editKey = `${section}:${key}`
    setSaving(s => ({ ...s, [editKey]: true }))
    try {
      await adminApi.updateSiteContent(section, key, edited[editKey])
      setMessage({ type: 'success', text: `Saved ${SECTION_LABELS[section] || section} / ${key}` })
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ type: 'error', text: 'Failed to save' })
    }
    setSaving(s => ({ ...s, [editKey]: false }))
  }

  const toggleExpand = (section) => {
    setExpanded(e => ({ ...e, [section]: !e[section] }))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">Site Content</h2>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {Object.entries(sections).map(([sectionKey, keys]) => (
        <div key={sectionKey} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => toggleExpand(sectionKey)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span className="font-medium text-text-primary dark:text-gray-100">
              {SECTION_LABELS[sectionKey] || sectionKey}
            </span>
            {expanded[sectionKey] ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>

          {expanded[sectionKey] && (
            <div className="px-5 pb-5 space-y-6 border-t border-gray-100 dark:border-gray-700 pt-4">
              {Object.entries(keys).map(([keyName, entry]) => {
                const editKey = `${sectionKey}:${keyName}`
                return (
                  <div key={keyName}>
                    {Object.keys(keys).length > 1 && (
                      <p className="text-xs text-text-secondary dark:text-gray-400 mb-2 uppercase tracking-wide">{keyName}</p>
                    )}
                    <SectionEditor
                      sectionKey={sectionKey}
                      keyName={keyName}
                      data={edited[editKey]}
                      onChange={(val) => setEdited(e => ({ ...e, [editKey]: val }))}
                    />
                    <div className="mt-3 flex items-center gap-3">
                      <Button
                        size="sm"
                        onClick={() => handleSave(sectionKey, keyName)}
                        loading={saving[editKey]}
                        disabled={saving[editKey]}
                      >
                        {saving[editKey] ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save
                      </Button>
                      <span className="text-xs text-text-secondary dark:text-gray-400">
                        Last updated: {entry.updated_at ? new Date(entry.updated_at).toLocaleDateString() : 'never'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
