import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Mock react-quill (not available in jsdom)
vi.mock('react-quill', () => ({
  default: function MockQuill({ value, onChange, placeholder }) {
    return React.createElement('textarea', {
      'data-testid': 'rich-text-editor',
      value: value || '',
      onChange: (e) => onChange && onChange(e.target.value),
      placeholder: placeholder
    })
  },
}))

// Mock react-datepicker
vi.mock('react-datepicker', () => ({
  default: function MockDatePicker({ selected, onChange, placeholderText }) {
    return React.createElement('input', {
      'data-testid': 'date-picker',
      type: 'text',
      value: selected ? selected.toISOString() : '',
      onChange: (e) => onChange && onChange(new Date(e.target.value)),
      placeholder: placeholderText
    })
  },
}))

// Mock MediaRecorder (not available in jsdom)
class MockMediaRecorder {
  constructor(stream) {
    this.stream = stream
    this.state = 'inactive'
    this.ondataavailable = null
    this.onstop = null
    this.onerror = null
  }
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['test'], { type: 'audio/webm' }) })
    }
    if (this.onstop) this.onstop()
  }
  pause() { this.state = 'paused' }
  resume() { this.state = 'recording' }
}
MockMediaRecorder.isTypeSupported = () => true
global.MediaRecorder = MockMediaRecorder

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    })
  },
  writable: true
})

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock IntersectionObserver (not available in jsdom)
class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback
  }
  observe() {
    // Immediately trigger as if element is visible
    this.callback([{ isIntersecting: true }])
  }
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockIntersectionObserver

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
global.localStorage = localStorageMock

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.getItem.mockReturnValue(null)
})
