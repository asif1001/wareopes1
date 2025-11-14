import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, within } from '@testing-library/react'
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

describe('MHE actions column', () => {
  it('opens dropdown and triggers Edit, Maintenance, Delete', async () => {
    const user = userEvent.setup()
    mockFetch({
      'GET /api/mhes?limit=50': () => new Response(JSON.stringify({ items: [{ id: 'm1', equipmentInfo: 'Forklift', status: 'Active' }] }), { status: 200 }),
      'GET /api/mhe-maintenance?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'PUT /api/mhes/m1': () => new Response(JSON.stringify({ item: { id: 'm1', status: 'Inactive' } }), { status: 200 }),
      'GET /api/gatepasses': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'GET /api/vehicle-maintenance?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'GET /api/vehicles?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
    })

    render(<MaintenanceClientPage initialUsers={[{ id: 'u1' } as any]} initialBranches={[{ id: 'b1', name: 'Main' } as any]} />)

    const tab = screen.getByRole('tab', { name: /MHE/i })
    await user.click(tab)

    const actionsCell = screen.getByRole('cell', { name: /Actions/i })
    const dropdownButton = within(actionsCell).getByRole('button', { name: /Open actions/i })
    await user.click(dropdownButton)

    const editItem = await screen.findByRole('menuitem', { name: /Edit MHE/i })
    await user.click(editItem)
    expect(await screen.findByText(/Edit MHE/i)).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await user.click(dropdownButton)
    const maintenanceItem = await screen.findByRole('menuitem', { name: /Open Maintenance/i })
    await user.click(maintenanceItem)
    expect(await screen.findByText(/Add Maintenance/i)).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await user.click(dropdownButton)
    const deleteItem = await screen.findByRole('menuitem', { name: /Delete MHE/i })
    await user.click(deleteItem)
    const confirm = await screen.findByRole('button', { name: /Delete/i })
    await user.click(confirm)
  })
})

describe('Gate Pass actions column', () => {
  it('edit, maintenance, soft delete', async () => {
    const user = userEvent.setup()
    mockFetch({
      'GET /api/gatepasses': () => new Response(JSON.stringify({ items: [{ id: 'g1', customerName: 'ABC', location: 'Sitra', passNumber: 'GP-1', status: 'Active' }] }), { status: 200 }),
      'PUT /api/gatepasses/g1': () => new Response(JSON.stringify({ item: { id: 'g1', status: 'Expired' } }), { status: 200 }),
      'GET /api/mhes?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'GET /api/mhe-maintenance?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'GET /api/vehicle-maintenance?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
      'GET /api/vehicles?limit=50': () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
    })

    render(<MaintenanceClientPage initialUsers={[{ id: 'u1' } as any]} initialBranches={[{ id: 'b1', name: 'Main' } as any]} />)

    const tab = screen.getByRole('tab', { name: /Gate Passes/i })
    await user.click(tab)

    const actionsCell = screen.getByRole('cell', { name: /Actions/i })
    const dropdownButton = within(actionsCell).getByRole('button', { name: /Open actions/i })
    await user.click(dropdownButton)

    const editItem = await screen.findByRole('menuitem', { name: /Edit Gate Pass/i })
    await user.click(editItem)
    expect(await screen.findByText(/Edit Gate Pass/i)).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await user.click(dropdownButton)
    const maintenanceItem = await screen.findByRole('menuitem', { name: /Open Maintenance/i })
    await user.click(maintenanceItem)
    expect(await screen.findByText(/Add Maintenance/i)).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await user.click(dropdownButton)
    const deleteItem = await screen.findByRole('menuitem', { name: /Delete Gate Pass/i })
    await user.click(deleteItem)
    const confirm = await screen.findByRole('button', { name: /Delete/i })
    await user.click(confirm)
  })
})