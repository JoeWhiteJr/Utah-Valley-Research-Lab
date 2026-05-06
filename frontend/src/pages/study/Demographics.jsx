import { useState } from 'react'
import { useStudyStore } from '../../store/studyStore'
import Button from '../../components/Button'
import Input from '../../components/Input'

const GENDER_OPTIONS = ['Female', 'Male', 'Non-binary', 'Prefer to self-describe', 'Prefer not to say']
const ETHNICITY_OPTIONS = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Hispanic or Latino',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Two or more races',
  'Prefer not to say',
]
const EDUCATION_OPTIONS = [
  'Less than high school',
  'High school / GED',
  'Some college',
  'Associate degree',
  'Bachelor’s degree',
  'Master’s degree',
  'Doctoral or professional degree',
  'Prefer not to say',
]

export default function StudyDemographics() {
  const { submitDemographics, loading, error } = useStudyStore()
  const [form, setForm] = useState({
    age: '',
    gender: '',
    gender_self: '',
    ethnicity: '',
    education: '',
    native_english: '',
  })

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const age = parseInt(form.age, 10)
    if (Number.isNaN(age) || age < 18 || age > 120) return
    const demographics = {
      age,
      gender: form.gender === 'Prefer to self-describe' ? form.gender_self || 'self-described' : form.gender,
      ethnicity: form.ethnicity,
      education: form.education,
      native_english: form.native_english,
      submitted_at: new Date().toISOString(),
    }
    await submitDemographics(demographics)
  }

  const isValid =
    form.age && form.gender && form.ethnicity && form.education && form.native_english

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-xl w-full">
        <h1 className="font-display font-bold text-2xl text-text-primary dark:text-gray-100 mb-2">
          One last thing
        </h1>
        <p className="text-text-secondary dark:text-gray-400 mb-6 text-sm">
          A few quick questions about you to help us describe the participant pool. All answers are anonymous.
        </p>
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Age"
            type="number"
            min="18"
            max="120"
            value={form.age}
            onChange={update('age')}
            required
          />
          <SelectField label="Gender" value={form.gender} onChange={update('gender')} options={GENDER_OPTIONS} />
          {form.gender === 'Prefer to self-describe' && (
            <Input
              label="Self-describe"
              type="text"
              value={form.gender_self}
              onChange={update('gender_self')}
            />
          )}
          <SelectField label="Race / ethnicity" value={form.ethnicity} onChange={update('ethnicity')} options={ETHNICITY_OPTIONS} />
          <SelectField label="Highest level of education" value={form.education} onChange={update('education')} options={EDUCATION_OPTIONS} />
          <SelectField
            label="Is English your native language?"
            value={form.native_english}
            onChange={update('native_english')}
            options={['Yes', 'No', 'Prefer not to say']}
          />
          <Button type="submit" loading={loading} disabled={!isValid} className="w-full" size="lg">
            Continue
          </Button>
        </form>
      </div>
    </div>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary dark:text-gray-200 mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={onChange}
        required
        className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-colors"
      >
        <option value="" disabled>Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}
