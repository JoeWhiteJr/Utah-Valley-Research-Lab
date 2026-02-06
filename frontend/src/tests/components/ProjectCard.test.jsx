import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ProjectCard from '../../components/ProjectCard'

// Helper to wrap component with router
const renderWithRouter = (ui) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('ProjectCard', () => {
  const mockProject = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Project',
    description: 'A test project description',
    status: 'active',
    progress: 50,
    header_image: null,
    total_actions: 10,
    completed_actions: 5,
    updated_at: '2025-01-15T10:30:00Z'
  }

  it('renders project title', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText('Test Project')).toBeInTheDocument()
  })

  it('renders project description', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText('A test project description')).toBeInTheDocument()
  })

  it('renders status badge', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('renders progress percentage', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('renders progress bar with correct width', () => {
    const { container } = renderWithRouter(<ProjectCard project={mockProject} />)
    const progressBar = container.querySelector('[style*="width: 50%"]')
    expect(progressBar).toBeInTheDocument()
  })

  it('renders action items count', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText('5 of 10 tasks done')).toBeInTheDocument()
  })

  it('links to project detail page', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/dashboard/projects/123e4567-e89b-12d3-a456-426614174000')
  })

  it('renders updated date', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText(/Updated/)).toBeInTheDocument()
  })

  describe('status colors', () => {
    it('applies active status color', () => {
      renderWithRouter(<ProjectCard project={{ ...mockProject, status: 'active' }} />)
      const badge = screen.getByText('active')
      expect(badge.className).toContain('bg-secondary-100')
    })

    it('applies completed status color', () => {
      renderWithRouter(<ProjectCard project={{ ...mockProject, status: 'completed' }} />)
      const badge = screen.getByText('completed')
      expect(badge.className).toContain('bg-green-100')
    })

    it('applies archived status color', () => {
      renderWithRouter(<ProjectCard project={{ ...mockProject, status: 'archived' }} />)
      const badge = screen.getByText('archived')
      expect(badge.className).toContain('bg-gray-100')
    })
  })

  describe('optional content', () => {
    it('hides description when not provided', () => {
      const projectWithoutDesc = { ...mockProject, description: null }
      renderWithRouter(<ProjectCard project={projectWithoutDesc} />)
      expect(screen.queryByText('A test project description')).not.toBeInTheDocument()
    })

    it('hides actions when showActions is false', () => {
      renderWithRouter(<ProjectCard project={mockProject} showActions={false} />)
      expect(screen.queryByText('5 of 10 tasks done')).not.toBeInTheDocument()
    })

    it('hides actions when total_actions is 0', () => {
      const projectNoActions = { ...mockProject, total_actions: 0, completed_actions: 0 }
      renderWithRouter(<ProjectCard project={projectNoActions} />)
      expect(screen.queryByText(/tasks done/)).not.toBeInTheDocument()
    })
  })

  describe('progress handling', () => {
    it('defaults to 0% when progress is null', () => {
      const projectNoProgress = { ...mockProject, progress: null }
      renderWithRouter(<ProjectCard project={projectNoProgress} />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('defaults to 0% when progress is undefined', () => {
      const projectNoProgress = { ...mockProject, progress: undefined }
      renderWithRouter(<ProjectCard project={projectNoProgress} />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('shows 100% progress', () => {
      const fullProgress = { ...mockProject, progress: 100 }
      renderWithRouter(<ProjectCard project={fullProgress} />)
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  describe('header image', () => {
    it('renders image when header_image is provided', () => {
      const projectWithImage = { ...mockProject, header_image: 'https://example.com/image.jpg' }
      renderWithRouter(<ProjectCard project={projectWithImage} />)
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'https://example.com/image.jpg')
    })

    it('renders gradient placeholder when no header_image', () => {
      const { container } = renderWithRouter(<ProjectCard project={mockProject} />)
      const gradient = container.querySelector('.bg-gradient-to-br')
      expect(gradient).toBeInTheDocument()
    })
  })
})
