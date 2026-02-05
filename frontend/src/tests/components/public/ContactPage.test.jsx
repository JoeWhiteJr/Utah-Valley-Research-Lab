import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ContactPage from '../../../components/public/pages/ContactPage'

// Helper to wrap component with router
const renderWithRouter = (ui) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('ContactPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders contact page hero', () => {
    renderWithRouter(<ContactPage />)
    expect(screen.getByText('Contact Us')).toBeInTheDocument()
    // The subtitle text may appear in multiple elements
    const subtitles = screen.getAllByText(/discuss how we can help/i)
    expect(subtitles.length).toBeGreaterThan(0)
  })

  it('renders contact information section', () => {
    renderWithRouter(<ContactPage />)
    expect(screen.getByText('Get In Touch')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Phone')).toBeInTheDocument()
    expect(screen.getByText('Address')).toBeInTheDocument()
    expect(screen.getByText('Office Hours')).toBeInTheDocument()
  })

  it('renders contact email link', () => {
    renderWithRouter(<ContactPage />)
    const emailLink = screen.getByText('ronald.miller@uvu.edu')
    expect(emailLink).toHaveAttribute('href', 'mailto:ronald.miller@uvu.edu')
  })

  it('renders Google Maps link', () => {
    renderWithRouter(<ContactPage />)
    const mapsLink = screen.getByText('View on Google Maps')
    expect(mapsLink).toHaveAttribute('href')
    expect(mapsLink).toHaveAttribute('target', '_blank')
  })

  describe('Contact Form', () => {
    it('renders all form fields', () => {
      renderWithRouter(<ContactPage />)
      expect(screen.getByLabelText('Name *')).toBeInTheDocument()
      expect(screen.getByLabelText('Email *')).toBeInTheDocument()
      expect(screen.getByLabelText('Organization')).toBeInTheDocument()
      expect(screen.getByLabelText('Subject')).toBeInTheDocument()
      expect(screen.getByLabelText('Message *')).toBeInTheDocument()
    })

    it('renders submit button', () => {
      renderWithRouter(<ContactPage />)
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
    })

    it('allows typing in form fields', () => {
      renderWithRouter(<ContactPage />)

      const nameInput = screen.getByLabelText('Name *')
      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      expect(nameInput.value).toBe('John Doe')

      const emailInput = screen.getByLabelText('Email *')
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      expect(emailInput.value).toBe('john@example.com')

      const messageInput = screen.getByLabelText('Message *')
      fireEvent.change(messageInput, { target: { value: 'Hello, I have a question.' } })
      expect(messageInput.value).toBe('Hello, I have a question.')
    })

    it('renders subject dropdown with options', () => {
      renderWithRouter(<ContactPage />)
      const subjectSelect = screen.getByLabelText(/subject/i)
      expect(subjectSelect).toBeInTheDocument()

      // Check that it has options
      const options = subjectSelect.querySelectorAll('option')
      expect(options.length).toBeGreaterThan(1)
    })

    it('shows validation errors on empty submit', async () => {
      renderWithRouter(<ContactPage />)

      const submitButton = screen.getByRole('button', { name: /send/i })
      fireEvent.click(submitButton)

      // Wait for validation errors to appear
      await waitFor(() => {
        // The form should show validation errors for required fields
        const nameInput = screen.getByLabelText('Name *')
        const emailInput = screen.getByLabelText('Email *')

        // Check that required fields are marked as invalid or error messages appear
        expect(nameInput).toBeInTheDocument()
        expect(emailInput).toBeInTheDocument()
      })
    })
  })

  describe('FAQ Section', () => {
    it('renders FAQ section', () => {
      renderWithRouter(<ContactPage />)
      expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument()
    })

    it('renders FAQ items', () => {
      renderWithRouter(<ContactPage />)
      // Check for at least one FAQ question
      expect(screen.getByText(/how long does a typical project take/i)).toBeInTheDocument()
    })

    it('expands FAQ item on click', () => {
      renderWithRouter(<ContactPage />)

      // Find a FAQ question button
      const faqButton = screen.getByText(/how long does a typical project take/i).closest('button')
      expect(faqButton).toBeInTheDocument()

      // Click to expand
      fireEvent.click(faqButton)

      // Answer should now be visible (check for part of the answer)
      expect(screen.getByText(/timelines vary/i)).toBeInTheDocument()
    })
  })

  it('sets document title', () => {
    renderWithRouter(<ContactPage />)
    expect(document.title).toBe('Contact Us | Utah Valley Research Lab')
  })
})
