import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { DashboardNav } from '@/components/dashboard-nav'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SidebarProvider, Sidebar, SidebarContent } from '@/components/ui/sidebar'

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
})

describe('DashboardNav task badge visibility', () => {
  it('shows badge when count > 0', async () => {
    setupFetch([{ tasks: 3, expiring: 0 }])
    render(
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <DashboardNav />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </TooltipProvider>
    )
    const el = await screen.findByLabelText(/Pending tasks.*3/i)
    expect(el).toBeTruthy()
    expect(el).toHaveAttribute('aria-live', 'polite')
    expect(el).toHaveAttribute('aria-atomic', 'true')
  })

  it('hides badge when count = 0', async () => {
    setupFetch([{ tasks: 0, expiring: 0 }])
    render(
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <DashboardNav />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </TooltipProvider>
    )
    const badges = screen.queryAllByRole('status')
    expect(badges.some(b => b.textContent === '0')).toBe(false)
  })

  it('updates visibility when count changes dynamically', async () => {
    vi.useFakeTimers()
    setupFetch([{ tasks: 2, expiring: 0 }, { tasks: 0, expiring: 0 }])
    render(
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <DashboardNav />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </TooltipProvider>
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(screen.getByLabelText(/Pending tasks.*2/i)).toBeTruthy()
    await vi.advanceTimersByTimeAsync(20000)
    vi.useRealTimers()
    expect(screen.queryByLabelText(/Pending tasks.*2/i)).toBeNull()
  })
})