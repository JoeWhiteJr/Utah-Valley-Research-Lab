import { Tag } from 'lucide-react'

export default function CategoryBadge({ name, color, size = 'sm', showIcon = false }) {
  // Convert hex color to RGB for calculating contrast
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 99, g: 102, b: 241 } // Default to indigo
  }

  // Calculate relative luminance for WCAG contrast
  const getLuminance = (r, g, b) => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  // Determine if we need dark or light text
  const rgb = hexToRgb(color || '#6366f1')
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b)
  const textColor = luminance > 0.5 ? '#1f2937' : '#ffffff'

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm'
  }

  const iconSizes = {
    xs: 10,
    sm: 12,
    md: 14
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]}`}
      style={{ backgroundColor: color || '#6366f1', color: textColor }}
    >
      {showIcon && <Tag size={iconSizes[size]} />}
      {name}
    </span>
  )
}
