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
})

describe('DashboardNav maintenance badge visibility', () => {
  it('shows badge when expiring count > 0', async () => {
    setupFetch([{ tasks: 0, expiring: 5 }])
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
    const el = await screen.findByLabelText(/Expiring maintenance items.*5/i)
    expect(el).toBeTruthy()
    expect(el).toHaveAttribute('aria-live', 'polite')
    expect(el).toHaveAttribute('aria-atomic', 'true')
  })

  it('hides badge when expiring count = 0', async () => {
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

  it('updates visibility when expiring count changes at 20s refresh', async () => {
    vi.useFakeTimers()
    setupFetch([{ tasks: 0, expiring: 2 }, { tasks: 0, expiring: 0 }])
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
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('2')
    await vi.advanceTimersByTimeAsync(20000)
    vi.useRealTimers()
    expect(screen.queryByLabelText(/Expiring maintenance items.*2/i)).toBeNull()
  })
})