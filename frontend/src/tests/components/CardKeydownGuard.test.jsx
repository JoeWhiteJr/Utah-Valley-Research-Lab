import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import NoteCard from '../../components/NoteCard'
import FileCard from '../../components/FileCard'
import ProjectCard from '../../components/ProjectCard'

// Regression test for the keydown bubbling guard:
// When focus is on an inner action button (Pin, Delete, Download, Preview),
// pressing Enter or Space must NOT trigger the wrapper's primary action.
// Without `if (e.target !== e.currentTarget) return` the inner key event
// bubbles up and fires the wrapper handler twice.

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>)

describe('Card keydown bubbling guard', () => {
  describe('NoteCard', () => {
    const baseNote = {
      id: 'note-1',
      title: 'Test note',
      content: 'Some content',
      creator_name: 'Alice',
      updated_at: '2025-01-15T10:30:00Z',
      is_pinned: false,
      pinned_for_project: false,
    }

    it('fires onEdit when Enter is pressed on the wrapper itself', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()
      const onTogglePin = vi.fn()
      render(
        <NoteCard
          note={baseNote}
          onEdit={onEdit}
          onDelete={onDelete}
          onTogglePin={onTogglePin}
        />
      )
      // The wrapper is the first role=button (the card itself).
      const wrapperEl = screen.getAllByRole('button')[0]
      fireEvent.keyDown(wrapperEl, { key: 'Enter' })
      expect(onEdit).toHaveBeenCalledTimes(1)
      expect(onEdit).toHaveBeenCalledWith(baseNote)
    })

    it('does NOT fire onEdit when Enter is pressed on the inner Pin button', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()
      const onTogglePin = vi.fn()
      render(
        <NoteCard
          note={baseNote}
          onEdit={onEdit}
          onDelete={onDelete}
          onTogglePin={onTogglePin}
        />
      )
      const pinBtn = screen.getByLabelText('Pin note')
      // Native button click semantics fire onTogglePin via click on Enter,
      // and the keydown bubbles to the wrapper. The guard must short-circuit
      // the wrapper handler so onEdit is NOT called from the bubbled keydown.
      fireEvent.keyDown(pinBtn, { key: 'Enter' })
      expect(onEdit).not.toHaveBeenCalled()
    })
  })

  describe('FileCard', () => {
    const baseFile = {
      id: 'file-1',
      original_filename: 'paper.pdf',
      filename: 'paper.pdf',
      file_type: 'application/pdf',
      file_size: 12345,
      uploaded_at: '2025-01-15T10:30:00Z',
      indexing_status: 'completed',
    }

    it('does NOT fire onPreview when Enter is pressed on the Download button', () => {
      const onPreview = vi.fn()
      const onDownload = vi.fn()
      const onDelete = vi.fn()
      render(
        <FileCard
          file={baseFile}
          onPreview={onPreview}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      )
      const downloadBtn = screen.getByLabelText('Download file')
      fireEvent.keyDown(downloadBtn, { key: 'Enter' })
      // The bubbled keydown must be guarded; the wrapper must not call onPreview.
      expect(onPreview).not.toHaveBeenCalled()
    })

    it('fires onPreview when Enter is pressed on the wrapper itself', () => {
      const onPreview = vi.fn()
      const onDownload = vi.fn()
      const onDelete = vi.fn()
      render(
        <FileCard
          file={baseFile}
          onPreview={onPreview}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      )
      const wrapperEl = screen.getAllByRole('button')[0]
      fireEvent.keyDown(wrapperEl, { key: 'Enter' })
      expect(onPreview).toHaveBeenCalledTimes(1)
      expect(onPreview).toHaveBeenCalledWith(baseFile)
    })
  })

  describe('ProjectCard', () => {
    const baseProject = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Test Project',
      subheader: 'Test subheader',
      status: 'active',
      header_image: null,
      member_count: 3,
      lead_name: 'Alice',
      updated_at: '2025-01-15T10:30:00Z',
    }

    it('fires onClick when Enter is pressed on the wrapper itself', () => {
      const onClick = vi.fn()
      renderWithRouter(<ProjectCard project={baseProject} onClick={onClick} />)
      const wrapperEl = screen.getAllByRole('button')[0]
      fireEvent.keyDown(wrapperEl, { key: 'Enter' })
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does NOT fire onClick when Enter is pressed on the inner Pin button', () => {
      const onClick = vi.fn()
      const onTogglePin = vi.fn()
      renderWithRouter(
        <ProjectCard
          project={baseProject}
          onClick={onClick}
          onTogglePin={onTogglePin}
        />
      )
      const pinBtn = screen.getByTitle('Pin project')
      fireEvent.keyDown(pinBtn, { key: 'Enter' })
      expect(onClick).not.toHaveBeenCalled()
    })
  })
})
