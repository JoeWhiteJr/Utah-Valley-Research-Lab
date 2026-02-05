import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Import all public page components
import PublicLayout from '../../../components/public/layout/PublicLayout'
import HomePage from '../../../components/public/pages/HomePage'
import AboutPage from '../../../components/public/pages/AboutPage'
import PublicProjectsPage from '../../../components/public/pages/PublicProjectsPage'
import TeamPage from '../../../components/public/pages/TeamPage'
import BlogPage from '../../../components/public/pages/BlogPage'
import ContactPage from '../../../components/public/pages/ContactPage'
import DonatePage from '../../../components/public/pages/DonatePage'

// Helper to render with specific route
const renderWithRoute = (initialRoute) => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/projects" element={<PublicProjectsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/donate" element={<DonatePage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('Public Site Routing', () => {
  describe('Home page route /', () => {
    it('renders home page at root path', () => {
      renderWithRoute('/')
      // Multiple elements may have "Utah Valley Research Lab" (hero + footer)
      const labNames = screen.getAllByText('Utah Valley Research Lab')
      expect(labNames.length).toBeGreaterThan(0)
      // Tagline may appear multiple times
      const taglines = screen.getAllByText('Turning Raw Data into Real Insight')
      expect(taglines.length).toBeGreaterThan(0)
    })
  })

  describe('About page route /about', () => {
    it('renders about page', () => {
      renderWithRoute('/about')
      expect(screen.getByText('About Us')).toBeInTheDocument()
      expect(screen.getByText('Our Mission')).toBeInTheDocument()
    })

    it('sets correct document title', () => {
      renderWithRoute('/about')
      expect(document.title).toBe('About Us | Utah Valley Research Lab')
    })
  })

  describe('Projects page route /projects', () => {
    it('renders projects page', () => {
      renderWithRoute('/projects')
      expect(screen.getByText('Our Projects')).toBeInTheDocument()
      expect(screen.getByText('Featured Projects')).toBeInTheDocument()
    })

    it('renders project filter buttons', () => {
      renderWithRoute('/projects')
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Ongoing')).toBeInTheDocument()
    })

    it('sets correct document title', () => {
      renderWithRoute('/projects')
      expect(document.title).toBe('Projects | Utah Valley Research Lab')
    })
  })

  describe('Team page route /team', () => {
    it('renders team page', () => {
      renderWithRoute('/team')
      // Our Team appears in both hero and navbar, Leadership may appear multiple times
      const teamHeaders = screen.getAllByText('Our Team')
      expect(teamHeaders.length).toBeGreaterThan(0)
      const leadershipHeaders = screen.getAllByText('Leadership')
      expect(leadershipHeaders.length).toBeGreaterThan(0)
    })

    it('renders team sections', () => {
      renderWithRoute('/team')
      expect(screen.getByText('Lab Leads')).toBeInTheDocument()
      expect(screen.getByText('Active Project Members')).toBeInTheDocument()
    })

    it('sets correct document title', () => {
      renderWithRoute('/team')
      expect(document.title).toBe('Our Team | Utah Valley Research Lab')
    })
  })

  describe('Blog page route /blog', () => {
    it('renders blog page', () => {
      renderWithRoute('/blog')
      expect(screen.getByText('Blog & Research')).toBeInTheDocument()
      expect(screen.getByText('Coming Soon')).toBeInTheDocument()
    })

    it('renders newsletter signup', () => {
      renderWithRoute('/blog')
      expect(screen.getByText('Stay Updated')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument()
    })

    it('sets correct document title', () => {
      renderWithRoute('/blog')
      expect(document.title).toBe('Blog & Research | Utah Valley Research Lab')
    })
  })

  describe('Contact page route /contact', () => {
    it('renders contact page', () => {
      renderWithRoute('/contact')
      expect(screen.getByText('Contact Us')).toBeInTheDocument()
      expect(screen.getByText('Get In Touch')).toBeInTheDocument()
    })

    it('renders contact form', () => {
      renderWithRoute('/contact')
      expect(screen.getByText('Send Us a Message')).toBeInTheDocument()
      expect(screen.getByLabelText('Name *')).toBeInTheDocument()
      expect(screen.getByLabelText('Email *')).toBeInTheDocument()
    })

    it('renders FAQ section', () => {
      renderWithRoute('/contact')
      expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument()
    })

    it('sets correct document title', () => {
      renderWithRoute('/contact')
      expect(document.title).toBe('Contact Us | Utah Valley Research Lab')
    })
  })

  describe('Donate page route /donate', () => {
    it('renders donate page', () => {
      renderWithRoute('/donate')
      expect(screen.getByText('Support Our Mission')).toBeInTheDocument()
      expect(screen.getByText('Why Your Support Matters')).toBeInTheDocument()
    })

    it('renders donation options', () => {
      renderWithRoute('/donate')
      expect(screen.getByText('One-Time Gift')).toBeInTheDocument()
      expect(screen.getByText('Monthly Giving')).toBeInTheDocument()
      expect(screen.getByText('Corporate Sponsorship')).toBeInTheDocument()
    })

    it('sets correct document title', () => {
      renderWithRoute('/donate')
      expect(document.title).toBe('Donate | Utah Valley Research Lab')
    })
  })

  describe('Layout components', () => {
    it('renders navbar on all pages', () => {
      renderWithRoute('/')
      expect(screen.getByText('UVRL')).toBeInTheDocument()
      expect(screen.getByLabelText('Toggle menu')).toBeInTheDocument()
    })

    it('renders footer on all pages', () => {
      renderWithRoute('/')
      expect(screen.getByText('Quick Links')).toBeInTheDocument()
      expect(screen.getByText('Connect')).toBeInTheDocument()
    })
  })
})
