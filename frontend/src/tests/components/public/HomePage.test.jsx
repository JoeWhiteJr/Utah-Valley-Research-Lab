import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import HomePage from '../../../components/public/pages/HomePage'

// Helper to wrap component with router
const renderWithRouter = (ui) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('HomePage', () => {
  it('renders the hero section with main title', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText('Utah Valley Research Lab')).toBeInTheDocument()
  })

  it('renders the hero tagline', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText('Turning Raw Data into Real Insight')).toBeInTheDocument()
  })

  it('renders hero CTA buttons', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText('View Our Work')).toBeInTheDocument()
    expect(screen.getByText('Get In Touch')).toBeInTheDocument()
  })

  it('renders stats section', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText('7+')).toBeInTheDocument()
    expect(screen.getByText('Active Projects')).toBeInTheDocument()
    expect(screen.getByText('22+')).toBeInTheDocument()
    expect(screen.getByText('Team Members')).toBeInTheDocument()
  })

  it('renders about summary section', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText('About Us')).toBeInTheDocument()
    expect(screen.getByText('Empowering Students Through Real-World Analytics')).toBeInTheDocument()
  })

  it('renders featured projects section', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText('Featured Projects')).toBeInTheDocument()
    expect(screen.getByText('Our Work')).toBeInTheDocument()
  })

  it('renders view all projects link', () => {
    renderWithRouter(<HomePage />)
    const viewAllLink = screen.getByText('View All Projects')
    expect(viewAllLink).toBeInTheDocument()
    expect(viewAllLink.closest('a')).toHaveAttribute('href', '/projects')
  })

  it('renders team preview section', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText('Our Team')).toBeInTheDocument()
    expect(screen.getByText('Meet the People Behind the Insights')).toBeInTheDocument()
  })

  it('renders services section', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText('What We Offer')).toBeInTheDocument()
    expect(screen.getByText('Our Services')).toBeInTheDocument()
  })

  it('renders CTA section at the bottom', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText('Ready to Turn Your Data Into Insights?')).toBeInTheDocument()
    expect(screen.getByText('Start a Project')).toBeInTheDocument()
    // Support Our Mission might appear multiple times (hero + CTA)
    const supportLinks = screen.getAllByText('Support Our Mission')
    expect(supportLinks.length).toBeGreaterThan(0)
  })

  it('sets the document title', () => {
    renderWithRouter(<HomePage />)
    expect(document.title).toBe('Utah Valley Research Lab | UVRL')
  })
})
