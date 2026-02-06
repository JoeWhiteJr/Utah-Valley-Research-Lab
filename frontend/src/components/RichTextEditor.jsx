import { useMemo } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

export default function RichTextEditor({
  label,
  value,
  onChange,
  placeholder = 'Write your content...',
  error,
  className = '',
  minHeight = '200px'
}) {
  // Configure toolbar modules
  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['blockquote'],
      ['link'],
      ['clean']
    ],
    clipboard: {
      matchVisual: false
    }
  }), [])

  // Configure allowed formats
  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'blockquote',
    'link'
  ]

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-1.5">
          {label}
        </label>
      )}

      <div className={`
        rounded-lg overflow-hidden
        ${error ? 'ring-1 ring-red-400' : ''}
      `}>
        <ReactQuill
          theme="snow"
          value={value || ''}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          style={{ minHeight }}
        />
      </div>

      {error && (
        <p className="mt-1.5 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}

// Component to render HTML content safely
export function RichTextContent({ content, className = '' }) {
  if (!content) return null

  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
