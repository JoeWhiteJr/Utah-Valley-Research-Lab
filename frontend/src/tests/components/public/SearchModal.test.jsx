import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import SearchModal from '../../../components/public/shared/SearchModal'

// Helper to wrap component with router
const renderWithRouter = (ui) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('SearchModal', () => {
  const mockClose = vi.fn()
  const mockSetQuery = vi.fn()

  const defaultProps = {
    isOpen: true,
    query: '',
    setQuery: mockSetQuery,
    groupedResults: {
      page: [],
      project: [],
      team: [],
    },
    hasResults: false,
    onClose: mockClose,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders when isOpen is true', () => {
    renderWithRouter(<SearchModal {...defaultProps} />)
    expect(screen.getByPlaceholderText(/search projects/i)).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    renderWithRouter(<SearchModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByPlaceholderText(/search projects/i)).not.toBeInTheDocument()
  })

  it('shows empty state when no query', () => {
    renderWithRouter(<SearchModal {...defaultProps} />)
    expect(screen.getByText('Start typing to search...')).toBeInTheDocument()
  })

  it('shows no results message when query has no matches', () => {
    renderWithRouter(
      <SearchModal
        {...defaultProps}
        query="xyz123nonexistent"
        hasResults={false}
      />
    )
    expect(screen.getByText(/no results found/i)).toBeInTheDocument()
  })

  it('calls setQuery when typing in search input', () => {
    renderWithRouter(<SearchModal {...defaultProps} />)
    const input = screen.getByPlaceholderText(/search projects/i)

    fireEvent.change(input, { target: { value: 'test' } })

    expect(mockSetQuery).toHaveBeenCalledWith('test')
  })

  it('calls onClose when close button is clicked', () => {
    renderWithRouter(<SearchModal {...defaultProps} />)

    // Find the close button (X icon button)
    const buttons = screen.getAllByRole('button')
    const closeButton = buttons.find(btn => btn.querySelector('svg'))

    fireEvent.click(closeButton)
    expect(mockClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape key is pressed', () => {
    renderWithRouter(<SearchModal {...defaultProps} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(mockClose).toHaveBeenCalled()
  })

  it('renders grouped results when available', () => {
    const propsWithResults = {
      ...defaultProps,
      query: 'test',
      hasResults: true,
      groupedResults: {
        page: [
          { title: 'About Page', path: '/about', description: 'Go to About page' }
        ],
        project: [
          { title: 'Growth Summit', path: '/projects', description: 'Research project' }
        ],
        team: [
          { title: 'John Doe', path: '/team', description: 'Lab Lead' }
        ],
      },
    }

    renderWithRouter(<SearchModal {...propsWithResults} />)

    expect(screen.getByText('Pages')).toBeInTheDocument()
    expect(screen.getByText('About Page')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Growth Summit')).toBeInTheDocument()
    expect(screen.getByText('Team Members')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('renders result items as links', () => {
    const propsWithResults = {
      ...defaultProps,
      query: 'about',
      hasResults: true,
      groupedResults: {
        page: [
          { title: 'About Page', path: '/about', description: 'Go to About page' }
        ],
        project: [],
        team: [],
      },
    }

    renderWithRouter(<SearchModal {...propsWithResults} />)

    const link = screen.getByText('About Page').closest('a')
    expect(link).toHaveAttribute('href', '/about')
  })

  it('calls onClose when a result is clicked', () => {
    const propsWithResults = {
      ...defaultProps,
      query: 'about',
      hasResults: true,
      groupedResults: {
        page: [
          { title: 'About Page', path: '/about', description: 'Go to About page' }
        ],
        project: [],
        team: [],
      },
    }

    renderWithRouter(<SearchModal {...propsWithResults} />)

    const link = screen.getByText('About Page').closest('a')
    fireEvent.click(link)

    expect(mockClose).toHaveBeenCalled()
  })

  it('shows keyboard hint in footer', () => {
    renderWithRouter(<SearchModal {...defaultProps} />)
    expect(screen.getByText('Esc')).toBeInTheDocument()
    expect(screen.getByText(/to close/i)).toBeInTheDocument()
  })

  it('focuses input when modal opens', () => {
    renderWithRouter(<SearchModal {...defaultProps} />)
    const input = screen.getByPlaceholderText(/search projects/i)
    expect(document.activeElement).toBe(input)
  })
})
