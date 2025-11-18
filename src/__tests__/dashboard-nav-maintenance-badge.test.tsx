import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { DashboardNav } from '@/components/dashboard-nav'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ permissions: { tasks: ['view'], maintenance: ['view'] }, isLoading: false }),
}))

const resp = (data: any, status = 200) => new Response(JSON.stringify(data), { status })

const setupFetch = (sequence: { tasks: number; expiring: number }[]) => {
  let i = 0
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo) => {
    const url = typeof input === 'string' ? input : (input as any).url
    const cur = sequence[Math.min(i, sequence.length - 1)]
    if (url.includes('/api/tasks/pending-count')) {
      return resp({ count: cur.tasks })
    }
    if (url.includes('/api/maintenance/expiring-count')) {
      i++
      return resp({ count: cur.expiring })
    }
    return resp({})
  }))
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.useFakeTimers()
})

describe('DashboardNav maintenance badge visibility', () => {
  it('shows badge when expiring count > 0', async () => {
    setupFetch([{ tasks: 0, expiring: 5 }])
    render(<DashboardNav />)
    const maintenanceLink = await screen.findByRole('link', { name: /Maintenance/i })
    const badge = within(maintenanceLink).getByRole('status')
    expect(badge).toHaveTextContent('5')
    expect(badge).toHaveAttribute('aria-live', 'polite')
    expect(badge).toHaveAttribute('aria-atomic', 'true')
  })

  it('hides badge when expiring count = 0', async () => {
    setupFetch([{ tasks: 0, expiring: 0 }])
    render(<DashboardNav />)
    const maintenanceLink = await screen.findByRole('link', { name: /Maintenance/i })
    expect(within(maintenanceLink).queryByRole('status')).toBeNull()
  })

  it('updates visibility when expiring count changes at 20s refresh', async () => {
    setupFetch([{ tasks: 0, expiring: 2 }, { tasks: 0, expiring: 0 }])
    render(<DashboardNav />)
    const maintenanceLink = await screen.findByRole('link', { name: /Maintenance/i })
    const badge = within(maintenanceLink).getByRole('status')
    expect(badge).toHaveTextContent('2')
    vi.advanceTimersByTime(20000)
    await Promise.resolve()
    expect(within(maintenanceLink).queryByRole('status')).toBeNull()
  })
})