import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import userEvent from '@testing-library/user-event'
import { MaintenanceClientPage } from '@/components/maintenance-client-page'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', branch: 'b1' }, isAdmin: true }),
}))

const user = {
  id: 'u1',
  fullName: 'Test Driver',
}

const licenses = [
  {
    id: 'lic-image-1',
    driverId: 'u1',
    vehicleType: 'Heavy',
    licenseNumber: 'DL-IMG-001',
    issueDate: new Date('2024-01-01').toISOString(),
    expiryDate: new Date('2026-01-01').toISOString(),
    attachmentUrl: 'https://example.com/a.jpg',
    remarks: 'Visual attachment',
  },
  {
    id: 'lic-pdf-1',
    driverId: 'u1',
    vehicleType: 'Light',
    licenseNumber: 'DL-PDF-001',
    issueDate: new Date('2023-01-01').toISOString(),
    expiryDate: new Date('2025-01-01').toISOString(),
    attachmentUrl: 'https://example.com/b.pdf',
    remarks: 'PDF attachment',
  },
] as any[]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: licenses }), { status: 200 })))
})

describe('License Detail Modal', () => {
  it('opens and shows complete details when a license row is clicked', async () => {
    render(
      <TooltipProvider>
        <MaintenanceClientPage initialUsers={[user] as any} initialLicenses={licenses as any} />
      </TooltipProvider>
    )
    const tabs = await screen.findAllByRole('tab')
    const tab = tabs.find(el => (el.textContent || '').includes('License')) as HTMLElement
    await userEvent.click(tab)
    const cell = await screen.findByText('DL-IMG-001')
    const row = cell.closest('tr') as HTMLElement
    const actions = within(row).getByRole('button', { name: /Open actions/i })
    await userEvent.click(actions)
    const preview = await screen.findByRole('menuitem', { name: /Preview/i })
    await userEvent.click(preview)

    expect(await screen.findByText('License Details')).toBeTruthy()
    expect(screen.getByText('License ID')).toBeTruthy()
    expect(screen.getByText('License Type')).toBeTruthy()
    expect(screen.getByText('Issue Date')).toBeTruthy()
    expect(screen.getByText('Expiration Date')).toBeTruthy()
    expect(screen.getByText('Status')).toBeTruthy()
    expect(screen.getByText('Associated Person')).toBeTruthy()
    expect(screen.getByText('Special Conditions / Notes')).toBeTruthy()
    expect(screen.getByText('DL-IMG-001')).toBeTruthy()
    expect(screen.getByText('Test Driver')).toBeTruthy()
  })

  it('renders attachment thumbnails and allows preview/download', async () => {
    render(
      <TooltipProvider>
        <MaintenanceClientPage initialUsers={[user] as any} initialLicenses={licenses as any} />
      </TooltipProvider>
    )
    const tabs = await screen.findAllByRole('tab')
    const tab = tabs.find(el => (el.textContent || '').includes('License')) as HTMLElement
    await userEvent.click(tab)
    const cell = await screen.findByText('DL-IMG-001')
    const row = cell.closest('tr') as HTMLElement
    const actions = within(row).getByRole('button', { name: /Open actions/i })
    await userEvent.click(actions)
    const preview = await screen.findByRole('menuitem', { name: /Preview/i })
    await userEvent.click(preview)

    const thumb = await screen.findByRole('button', { name: /Preview attachment/i })
    await userEvent.click(thumb)

    expect(await screen.findByAltText('a.jpg')).toBeTruthy()
    const download = screen.getByRole('link', { name: /Download attachment/i })
    expect(download).toHaveAttribute('href', 'https://example.com/a.jpg')
  })

  it('supports PDF preview open link', async () => {
    render(
      <TooltipProvider>
        <MaintenanceClientPage initialUsers={[user] as any} initialLicenses={licenses as any} />
      </TooltipProvider>
    )
    const tabs = await screen.findAllByRole('tab')
    const tab = tabs.find(el => (el.textContent || '').includes('License')) as HTMLElement
    await userEvent.click(tab)
    const cell = await screen.findByText('DL-PDF-001')
    const row = cell.closest('tr') as HTMLElement
    const actions = within(row).getByRole('button', { name: /Open actions/i })
    await userEvent.click(actions)
    const preview = await screen.findByRole('menuitem', { name: /Preview/i })
    await userEvent.click(preview)

    const pdfThumb = await screen.findByRole('button', { name: /Preview attachment/i })
    await userEvent.click(pdfThumb)
    expect(await screen.findByText(/Open file/i)).toBeTruthy()
  })
})