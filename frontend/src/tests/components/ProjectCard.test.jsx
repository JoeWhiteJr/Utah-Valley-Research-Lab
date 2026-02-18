import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    important_info: 'Subtitle text here',
    status: 'active',
    header_image: null,
    member_count: 3,
    lead_name: 'Alice',
    members_preview: [
      { user_id: 'u1', name: 'Alice Lead', avatar_url: null, role: 'lead' },
      { user_id: 'u2', name: 'Bob Member', avatar_url: null, role: 'member' },
      { user_id: 'u3', name: 'Carol Member', avatar_url: null, role: 'member' },
    ],
    updated_at: '2025-01-15T10:30:00Z'
  }

  it('renders project title', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText('Test Project')).toBeInTheDocument()
  })

  it('renders subtitle (important_info)', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText('Subtitle text here')).toBeInTheDocument()
  })

  it('hides subtitle when not provided', () => {
    const projectNoSubtitle = { ...mockProject, important_info: null }
    renderWithRouter(<ProjectCard project={projectNoSubtitle} />)
    expect(screen.queryByText('Subtitle text here')).not.toBeInTheDocument()
  })

  it('renders status badge', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('renders lead name first in footer', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText(/Lead: Alice/)).toBeInTheDocument()
  })

  it('renders member count', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText(/3 members/)).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    renderWithRouter(<ProjectCard project={mockProject} onClick={handleClick} />)
    const card = screen.getByRole('button')
    fireEvent.click(card)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  describe('pin button', () => {
    it('renders pin button when onTogglePin is provided', () => {
      const handlePin = vi.fn()
      renderWithRouter(<ProjectCard project={mockProject} onTogglePin={handlePin} />)
      expect(screen.getByTitle('Pin project')).toBeInTheDocument()
    })

    it('calls onTogglePin with project id when pin button clicked', () => {
      const handlePin = vi.fn()
      renderWithRouter(<ProjectCard project={mockProject} onTogglePin={handlePin} />)
      fireEvent.click(screen.getByTitle('Pin project'))
      expect(handlePin).toHaveBeenCalledWith(mockProject.id)
    })

    it('shows unpin title when isPinned is true', () => {
      const handlePin = vi.fn()
      renderWithRouter(<ProjectCard project={mockProject} isPinned={true} onTogglePin={handlePin} />)
      expect(screen.getByTitle('Unpin project')).toBeInTheDocument()
    })

    it('does not render pin button when onTogglePin is not provided', () => {
      renderWithRouter(<ProjectCard project={mockProject} />)
      expect(screen.queryByTitle('Pin project')).not.toBeInTheDocument()
    })
  })

  describe('member avatars', () => {
    it('renders member avatar initials', () => {
      renderWithRouter(<ProjectCard project={mockProject} />)
      expect(screen.getByText('A')).toBeInTheDocument() // Alice
      expect(screen.getByText('B')).toBeInTheDocument() // Bob
      expect(screen.getByText('C')).toBeInTheDocument() // Carol
    })

    it('renders +N overflow badge when more than 5 members', () => {
      const manyMembers = {
        ...mockProject,
        member_count: 8,
        members_preview: [
          { user_id: 'u1', name: 'A User', avatar_url: null, role: 'lead' },
          { user_id: 'u2', name: 'B User', avatar_url: null, role: 'member' },
          { user_id: 'u3', name: 'C User', avatar_url: null, role: 'member' },
          { user_id: 'u4', name: 'D User', avatar_url: null, role: 'member' },
          { user_id: 'u5', name: 'E User', avatar_url: null, role: 'member' },
          { user_id: 'u6', name: 'F User', avatar_url: null, role: 'member' },
        ]
      }
      renderWithRouter(<ProjectCard project={manyMembers} />)
      expect(screen.getByText('+3')).toBeInTheDocument()
    })

    it('does not render overflow badge when 5 or fewer members', () => {
      renderWithRouter(<ProjectCard project={mockProject} />)
      expect(screen.queryByText(/^\+/)).not.toBeInTheDocument()
    })
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

  describe('header image', () => {
    it('renders image when header_image is provided', () => {
      const projectWithImage = { ...mockProject, header_image: 'https://example.com/image.jpg' }
      renderWithRouter(<ProjectCard project={projectWithImage} />)
      const img = screen.getAllByRole('img')[0]
      expect(img).toHaveAttribute('src', 'https://example.com/image.jpg')
    })

    it('renders gradient placeholder when no header_image', () => {
      const { container } = renderWithRouter(<ProjectCard project={mockProject} />)
      const gradient = container.querySelector('.bg-gradient-to-br')
      expect(gradient).toBeInTheDocument()
    })
  })
})
