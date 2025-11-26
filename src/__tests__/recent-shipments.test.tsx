import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { RecentShipments } from '@/components/recent-shipments'

vi.mock('@/lib/firebase/firestore', () => ({
  getBranches: async () => ([{ id: 'b1', name: 'Main' }])
}))

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('RecentShipments - Upcoming Container Bookings', () => {
  it('shows Source for complete data', () => {
    const shipments = [
      {
        id: 'S1',
        source: 'Shanghai',
        invoice: 'INV-001',
        billOfLading: 'BL-1',
        status: 'Arrived',
        branch: 'Main',
        numContainers: 1,
        containers: [],
        bahrainEta: new Date().toISOString(),
        originalDocumentReceiptDate: null,
        actualBahrainEta: null,
        lastStorageDay: null,
        whEtaRequestedByParts: null,
        whEtaConfirmedByLogistics: null,
        cleared: true,
        actualClearedDate: null,
        totalCases: 10,
        domLines: 0,
        bulkLines: 0,
        totalLines: 10,
        generalRemark: '',
        remark: '',
        bookings: [{ containerNo: 'CONT-1', bookingDate: new Date().toISOString() }],
        monthYear: 'Aug 24',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'u1',
        updatedBy: 'u1',
      } as any,
    ]
    render(<RecentShipments shipments={shipments as any} />)
    expect(screen.getByText(/Upcoming Container Bookings/i)).toBeInTheDocument()
    expect(screen.getByText(/Container No/i)).toBeInTheDocument()
    expect(screen.getByText(/Source/i)).toBeInTheDocument()
    expect(screen.getByText('CONT-1')).toBeInTheDocument()
    expect(screen.getByText('Shanghai')).toBeInTheDocument()
  })

  it('handles missing Source', () => {
    const shipments = [
      {
        id: 'S2',
        source: '',
        invoice: 'INV-002',
        billOfLading: 'BL-2',
        status: 'Arrived',
        branch: '',
        numContainers: 1,
        containers: [],
        bahrainEta: new Date().toISOString(),
        originalDocumentReceiptDate: null,
        actualBahrainEta: null,
        lastStorageDay: null,
        whEtaRequestedByParts: null,
        whEtaConfirmedByLogistics: null,
        cleared: true,
        actualClearedDate: null,
        totalCases: 10,
        domLines: 0,
        bulkLines: 0,
        totalLines: 10,
        generalRemark: '',
        remark: '',
        bookings: [{ containerNo: 'CONT-2', bookingDate: new Date().toISOString() }],
        monthYear: 'Aug 24',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'u1',
        updatedBy: 'u1',
      } as any,
    ]
    render(<RecentShipments shipments={shipments as any} />)
    expect(screen.getByText('CONT-2')).toBeInTheDocument()
    // Branch column removed; only verify container and Source rendering
  })

  it('does not display branch name after removal', async () => {
    const shipments = [
      {
        id: 'S3',
        source: 'Shanghai',
        invoice: 'INV-003',
        billOfLading: 'BL-3',
        status: 'Arrived',
        branch: 'b1',
        numContainers: 1,
        containers: [],
        bahrainEta: new Date().toISOString(),
        originalDocumentReceiptDate: null,
        actualBahrainEta: null,
        lastStorageDay: null,
        whEtaRequestedByParts: null,
        whEtaConfirmedByLogistics: null,
        cleared: true,
        actualClearedDate: null,
        totalCases: 10,
        domLines: 0,
        bulkLines: 0,
        totalLines: 10,
        generalRemark: '',
        remark: '',
        bookings: [{ containerNo: 'CONT-3', bookingDate: new Date().toISOString() }],
        monthYear: 'Aug 24',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'u1',
        updatedBy: 'u1',
      } as any,
    ]
    render(<RecentShipments shipments={shipments as any} />)
    // Branch name should not be displayed anywhere in the card
    expect(screen.queryByText('Main')).not.toBeInTheDocument()
  })
})
