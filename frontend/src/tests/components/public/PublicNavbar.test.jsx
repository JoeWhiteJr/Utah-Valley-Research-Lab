import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import PublicNavbar from '../../../components/public/layout/PublicNavbar'

// Helper to wrap component with router
const renderWithRouter = (ui) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('PublicNavbar', () => {
  it('renders the site logo/name', () => {
    renderWithRouter(<PublicNavbar />)
    expect(screen.getByText('UVRL')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    renderWithRouter(<PublicNavbar />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('About')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.getByText('Contact')).toBeInTheDocument()
  })

  it('renders the donate button', () => {
    renderWithRouter(<PublicNavbar />)
    const donateButtons = screen.getAllByText('Donate')
    expect(donateButtons.length).toBeGreaterThan(0)
  })

  it('renders search button on desktop', () => {
    renderWithRouter(<PublicNavbar />)
    const searchButtons = screen.getAllByRole('button')
    const searchButton = searchButtons.find(btn => btn.textContent.includes('Search'))
    expect(searchButton).toBeInTheDocument()
  })

  it('renders mobile menu button', () => {
    renderWithRouter(<PublicNavbar />)
    const menuButton = screen.getByLabelText('Toggle menu')
    expect(menuButton).toBeInTheDocument()
  })

  it('toggles mobile menu when button is clicked', () => {
    renderWithRouter(<PublicNavbar />)
    const menuButton = screen.getByLabelText('Toggle menu')

    // Mobile menu should not be visible initially (checking for mobile search button)
    const mobileSearchBeforeClick = screen.queryAllByText('Search...')
    expect(mobileSearchBeforeClick.length).toBe(1) // Only desktop search

    // Click to open mobile menu
    fireEvent.click(menuButton)

    // Mobile menu should now show search button
    const mobileSearchAfterClick = screen.getAllByText('Search...')
    expect(mobileSearchAfterClick.length).toBe(2) // Desktop + mobile
  })

  it('has correct link paths', () => {
    renderWithRouter(<PublicNavbar />)

    // Check that links have correct href attributes
    const homeLinks = screen.getAllByText('Home')
    expect(homeLinks[0].closest('a')).toHaveAttribute('href', '/')

    const aboutLinks = screen.getAllByText('About')
    expect(aboutLinks[0].closest('a')).toHaveAttribute('href', '/about')

    const projectsLinks = screen.getAllByText('Projects')
    expect(projectsLinks[0].closest('a')).toHaveAttribute('href', '/projects')
  })

  describe('keyboard shortcuts', () => {
    it('opens search modal on Ctrl+K', () => {
      renderWithRouter(<PublicNavbar />)

      // Dispatch keyboard event
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })

      // Search modal should appear (checking for search input placeholder)
      expect(screen.getByPlaceholderText(/search projects/i)).toBeInTheDocument()
    })

    it('opens search modal on Cmd+K (Mac)', () => {
      renderWithRouter(<PublicNavbar />)

      // Dispatch keyboard event with metaKey (Cmd on Mac)
      fireEvent.keyDown(document, { key: 'k', metaKey: true })

      // Search modal should appear
      expect(screen.getByPlaceholderText(/search projects/i)).toBeInTheDocument()
    })
  })
})
