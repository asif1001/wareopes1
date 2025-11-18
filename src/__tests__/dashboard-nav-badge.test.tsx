import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { DashboardNav } from '@/components/dashboard-nav'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ permissions: { tasks: ['view'], maintenance: ['view'] }, isLoading: false }),
}))

const resp = (data: any, status = 200) => new Response(JSON.stringify(data), { status })

const setupFetch = (sequence: { tasks: number; expiring?: number }[]) => {
  let i = 0
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo) => {
    const url = typeof input === 'string' ? input : (input as any).url
    const cur = sequence[Math.min(i, sequence.length - 1)]
    if (url.includes('/api/tasks/pending-count')) {
      i++
      return resp({ count: cur.tasks })
    }
    if (url.includes('/api/maintenance/expiring-count')) {
      return resp({ count: cur.expiring ?? 0 })
    }
    return resp({})
  }))
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.useFakeTimers()
})

describe('DashboardNav task badge visibility', () => {
  it('shows badge when count > 0', async () => {
    setupFetch([{ tasks: 3, expiring: 0 }])
    render(<DashboardNav />)
    const tasksLink = await screen.findByRole('link', { name: /Tasks/i })
    const badge = within(tasksLink).getByRole('status')
    expect(badge).toHaveTextContent('3')
    expect(badge).toHaveAttribute('aria-live', 'polite')
    expect(badge).toHaveAttribute('aria-atomic', 'true')
  })

  it('hides badge when count = 0', async () => {
    setupFetch([{ tasks: 0, expiring: 0 }])
    render(<DashboardNav />)
    const tasksLink = await screen.findByRole('link', { name: /Tasks/i })
    expect(within(tasksLink).queryByRole('status')).toBeNull()
  })

  it('updates visibility when count changes dynamically', async () => {
    setupFetch([{ tasks: 2, expiring: 0 }, { tasks: 0, expiring: 0 }])
    render(<DashboardNav />)
    const tasksLink = await screen.findByRole('link', { name: /Tasks/i })
    const badge = within(tasksLink).getByRole('status')
    expect(badge).toHaveTextContent('2')
    vi.advanceTimersByTime(20000)
    await Promise.resolve()
    expect(within(tasksLink).queryByRole('status')).toBeNull()
  })
})