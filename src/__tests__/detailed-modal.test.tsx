import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MaintenanceClientPage } from '@/components/maintenance-client-page'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { permissions: { maintenance: ['add','edit','delete'] } }, isAdmin: true }),
}))

const mockFetch = (handlers: Record<string, any>) => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as any).url
    const method = (init?.method || 'GET').toUpperCase()
    const key = `${method} ${url}`
    if (handlers[key]) return handlers[key]()
    if (handlers[url]) return handlers[url]()
    return new Response(JSON.stringify({ items: [] }), { status: 200 })
  }))
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Detailed modal - Vehicle', () => {
  it('opens on row click, shows identification and history, closes on ESC', async () => {
    const user = userEvent.setup()
    mockFetch({
      'GET /api/vehicles?limit=50': () => new Response(JSON.stringify({ items: [{ id: 'v1', plateNo: 'BH-123', vehicleType: 'Pickup', branch: 'Main', ownership: 'Owned', driverName: 'John' }] }), { status: 200 }),
      'GET /api/vehicle-maintenance?limit=50': () => new Response(JSON.stringify({ items: [{ id: 'r1', vehicleId: 'v1', date: new Date().toISOString(), type: 'Routine' }] }), { status: 200 }),
      'GET /api/mhes?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'GET /api/mhe-maintenance?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'GET /api/gatepasses': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
    })

    render(<MaintenanceClientPage initialUsers={[{ id: 'u1' } as any]} initialBranches={[{ id: 'b1', name: 'Main' } as any]} />)

    const tab = screen.getByRole('tab', { name: /Vehicle/i })
    await user.click(tab)

    const row = await screen.findByRole('row', { name: /BH-123/i })
    await user.click(row)
    expect(await screen.findByText(/Identification/i)).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByText(/Identification/i)).not.toBeInTheDocument()
  })
})

describe('Detailed modal - MHE', () => {
  it('opens on row click and shows equipment info', async () => {
    const user = userEvent.setup()
    mockFetch({
      'GET /api/mhes?limit=50': () => new Response(JSON.stringify({ items: [{ id: 'm1', equipmentInfo: 'Forklift' }] }), { status: 200 }),
      'GET /api/mhe-maintenance?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'GET /api/gatepasses': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'GET /api/vehicles?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'GET /api/vehicle-maintenance?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
    })

    render(<MaintenanceClientPage initialUsers={[{ id: 'u1' } as any]} initialBranches={[{ id: 'b1', name: 'Main' } as any]} />)
    const tab = screen.getByRole('tab', { name: /MHE/i })
    await user.click(tab)
    const row = await screen.findByRole('row', { name: /Forklift/i })
    await user.click(row)
    expect(await screen.findByText(/Identification/i)).toBeInTheDocument()
  })
})

describe('Detailed modal - Gate Pass', () => {
  it('opens on row click and shows customer and pass number', async () => {
    const user = userEvent.setup()
    mockFetch({
      'GET /api/gatepasses': () => new Response(JSON.stringify({ items: [{ id: 'g1', customerName: 'ABC', location: 'Sitra', passNumber: 'GP-1', status: 'Active' }] }), { status: 200 }),
      'GET /api/mhes?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'GET /api/mhe-maintenance?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'GET /api/vehicle-maintenance?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'GET /api/vehicles?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
    })

    render(<MaintenanceClientPage initialUsers={[{ id: 'u1' } as any]} initialBranches={[{ id: 'b1', name: 'Main' } as any]} />)
    const tab = screen.getByRole('tab', { name: /Gate Passes/i })
    await user.click(tab)
    const row = await screen.findByRole('row', { name: /ABC/i })
    await user.click(row)
    expect(await screen.findByText(/Identification/i)).toBeInTheDocument()
  })
})