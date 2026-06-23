import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  CONDITION_LABELS,
  displayCondition,
  largestDrop,
} from '../../../pages/admin/ResearchStudies'

// ─── Unit: CONDITION_LABELS / displayCondition ────────────────────────────────

describe('CONDITION_LABELS', () => {
  it('maps every defined key to a human-readable label', () => {
    expect(CONDITION_LABELS.BASELINE).toBe('Baseline')
    expect(CONDITION_LABELS.HIGH_EFFORT).toBe('High effort')
    expect(CONDITION_LABELS.NR_PATTERN).toBe('N→R pattern')
    expect(CONDITION_LABELS.RN_PATTERN).toBe('R→N pattern')
    expect(CONDITION_LABELS.RANDOM).toBe('Random')
    expect(CONDITION_LABELS.WITHIN_SUBJECTS).toBe('Within-subjects')
  })
})

describe('displayCondition', () => {
  it('returns the human label for a known key', () => {
    expect(displayCondition('NR_PATTERN')).toBe('N→R pattern')
    expect(displayCondition('BASELINE')).toBe('Baseline')
  })

  it('falls back to the raw string for an unknown key', () => {
    expect(displayCondition('SOME_FUTURE_CONDITION')).toBe('SOME_FUTURE_CONDITION')
  })
})

// ─── Unit: largestDrop ────────────────────────────────────────────────────────

describe('largestDrop', () => {
  it('returns null when no step exceeds the 40% threshold', () => {
    const row = { landed: 100, consented: 90, responded: 80, demographics: 75, completed: 70 }
    expect(largestDrop(row)).toBeNull()
  })

  it('flags a step when more than 40% drop from the prior stage', () => {
    // consented→responded drops from 100→50 = 50% drop
    // landed→consented only drops from 200→100 = 50% — tie broken by iteration order
    // Make consented→responded clearly the worst: 100→30 = 70% drop
    const row = { landed: 200, consented: 100, responded: 30, demographics: 28, completed: 25 }
    const result = largestDrop(row)
    expect(result).not.toBeNull()
    expect(result.stepName).toBe('consented→responded')
    expect(result.dropPct).toBeGreaterThan(0.4)
  })

  it('returns the worst drop when multiple steps are large', () => {
    // landed→consented: 100→55 = 45% drop
    // consented→responded: 55→10 = ~81.8% drop  (clearly worse)
    const row = { landed: 100, consented: 55, responded: 10, demographics: 9, completed: 8 }
    const result = largestDrop(row)
    expect(result).not.toBeNull()
    expect(result.stepName).toBe('consented→responded')
  })

  it('handles zero denominator gracefully', () => {
    const row = { landed: 0, consented: 0, responded: 0, demographics: 0, completed: 0 }
    expect(largestDrop(row)).toBeNull()
  })
})

// ─── Component: FunnelCard renders drop badge ─────────────────────────────────

// The FunnelCard is not exported, so we drive it through the page component by
// mocking studyApi with controlled funnel data.
vi.mock('../../../services/api', () => ({
  studyApi: {
    stats: vi.fn().mockResolvedValue({
      data: {
        stats: {},
        study: { slug: 'effort-justification' },
      },
    }),
    funnel: vi.fn().mockResolvedValue({
      data: {
        funnel: [
          {
            experiment: 'treasure_hunt',
            condition: 'NR_PATTERN',
            landed: 100,
            consented: 100,
            // responded→consented drops 60% — should trigger badge
            responded: 40,
            demographics: 38,
            completed: 35,
          },
          {
            experiment: 'treasure_hunt',
            condition: 'BASELINE',
            landed: 100,
            consented: 95,
            responded: 90,
            demographics: 88,
            completed: 85,
          },
        ],
      },
    }),
    limitHits: vi.fn().mockResolvedValue({
      data: { limit_hits_today: { payload_too_big: 0, snapshot_cap: 0 } },
    }),
  },
}))

import ResearchStudies from '../../../pages/admin/ResearchStudies'

function renderPage() {
  return render(
    <MemoryRouter>
      <ResearchStudies />
    </MemoryRouter>
  )
}

describe('FunnelCard — human labels', () => {
  it('renders "N→R pattern" instead of the raw slug "NR_PATTERN"', async () => {
    renderPage()
    await waitFor(() => {
      // The condition label is rendered inside a span as "/ N→R pattern" so we
      // search by partial text match using a regex.
      expect(screen.getAllByText(/N→R pattern/i).length).toBeGreaterThan(0)
    })
    // The raw slug must not appear as a standalone visible text node.
    expect(screen.queryAllByText(/^NR_PATTERN$/).length).toBe(0)
  })

  it('renders "Treasure Hunt" instead of the raw slug "treasure_hunt"', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('Treasure Hunt').length).toBeGreaterThan(0)
    })
    // The raw slug must not appear as a standalone visible text node in funnel rows.
    expect(screen.queryAllByText(/^treasure_hunt$/).length).toBe(0)
  })
})

describe('FunnelCard — drop-rate highlight', () => {
  it('renders the warning badge for a >40% step drop', async () => {
    renderPage()
    await waitFor(() => {
      // Badge text matches "↓ XX% drop at consented→responded"
      const badge = screen.getByText(/↓.*drop at consented→responded/i)
      expect(badge).toBeInTheDocument()
    })
  })

  it('does not render a badge for rows without a large drop', async () => {
    renderPage()
    await waitFor(() => {
      // The BASELINE row has no large drop — only one badge total
      const badges = screen.queryAllByText(/↓.*drop at/)
      expect(badges).toHaveLength(1)
    })
  })
})

describe('FunnelCard — mobile responsive class', () => {
  it('applies flex-col class to the mobile stage list container', async () => {
    renderPage()
    await waitFor(() => {
      // The mobile stage list uses flex-col; verify at least one such node exists
      const mobileLists = document.querySelectorAll('.flex-col')
      expect(mobileLists.length).toBeGreaterThan(0)
    })
  })

  it('applies sm:flex-row to the stage container for larger screens', async () => {
    renderPage()
    await waitFor(() => {
      const smFlexRow = document.querySelectorAll('[class*="sm:flex-row"]')
      expect(smFlexRow.length).toBeGreaterThan(0)
    })
  })
})
