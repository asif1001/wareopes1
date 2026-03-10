import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DispatchForm } from '@/components/dispatch-form'

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => (values: any) => ({
    values: {
      ...values,
      numberOfCases: values.numberOfCases ?? 1,
      containers: values.containers ?? [
        {
          containerId: 'c1',
          containerNumber: '',
          containerSize: '20ft',
          bookingNumber: '',
          bookingDate: new Date(),
          numberOfCases: 1,
          status: 'Pending',
          inspectionRemark: '',
          modeOfTransport: 'Road',
          trailerNumber: '',
          driverCPR: '',
          driverPhone: '',
          driverName: '',
          loaderName: '',
          checkerName: '',
        }
      ],
    },
    errors: {},
  }),
}))

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }: any) => (open ? <div role="alertdialog">{children}</div> : null),
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}))

const { createDispatch } = vi.hoisted(() => ({
  createDispatch: vi.fn(async () => ({
  id: 'd1',
  dateTime: new Date('2024-01-10T10:00:00Z').toISOString(),
  invoiceNo: 'INV-1',
  customerName: 'Customer',
  customerCode: 'C1',
  containers: [
    {
      containerId: 'c1',
      containerNumber: 'CONT-1',
      containerSize: '20ft',
      bookingNumber: 'BKG-1',
      bookingDate: new Date('2024-01-10T10:00:00Z').toISOString(),
      numberOfCases: 10,
      inspectionRemark: '',
      transport: {
        modeOfTransport: 'Road',
        trailerNumber: 'TR-1',
        driverCPR: 'CPR-1',
        driverPhone: '123456789',
        driverName: 'Driver',
      },
      personnel: {
        loaderName: 'Alice',
        checkerName: 'Alice',
      },
      photos: [],
    }
  ],
  noOfContainer: 1,
  noOfCases: 10,
  containerNo: 'CONT-1',
  containerSize: '20ft',
  loadingDate: new Date('2024-01-11T10:00:00Z').toISOString(),
  status: 'Pending',
  createdAt: new Date('2024-01-10T10:00:00Z').toISOString(),
  updatedAt: new Date('2024-01-10T10:00:00Z').toISOString(),
  })),
}))

vi.mock('@/lib/firebase/firestore', () => ({
  DispatchService: {
    createDispatch,
    updateDispatch: vi.fn(async () => createDispatch()),
  },
}))

vi.mock('@/lib/firebase/storage', () => ({
  uploadFiles: vi.fn(),
}))

describe('DispatchForm', () => {
  it('creates a dispatch and notifies parent', async () => {
    const onCreated = vi.fn()
    const user = userEvent.setup()

    render(
      <DispatchForm
        users={[{ id: 'u1', fullName: 'Alice' } as any]}
        containerSizes={[{ id: 'c1', size: '20ft', cmb: '33' } as any]}
        onCreated={onCreated}
      />
    )

    await user.click(screen.getByText(/Add Dispatch/i))

    await user.type(screen.getByLabelText(/Invoice No\*/i), 'INV-1')
    await user.type(screen.getByLabelText(/Customer Name\*/i), 'Customer')
    await user.type(screen.getByLabelText(/Customer Code\*/i), 'C1')
    await user.clear(screen.getByLabelText(/Number of Cases\*/i))
    await user.type(screen.getByLabelText(/Number of Cases\*/i), '1')
    await user.click(screen.getByText(/Add Container/i))

    await user.type(screen.getByLabelText(/Container Number\*/i), 'CONT-1')
    await user.type(screen.getByLabelText(/Booking Number\*/i), 'BKG-1')
    await user.type(screen.getByLabelText(/Trailer Number\*/i), 'TR-1')
    await user.type(screen.getByLabelText(/Driver Name\*/i), 'Driver')
    await user.type(screen.getByLabelText(/Driver CPR\*/i), 'CPR-1')
    await user.type(screen.getByLabelText(/Driver Phone\*/i), '123456789')

    await user.click(screen.getByText(/Select loader/i))
    const loaderOptions = await screen.findAllByText('Alice')
    await user.click(loaderOptions[loaderOptions.length - 1])

    await user.click(screen.getByText(/Select checker/i))
    const checkerOptions = await screen.findAllByText('Alice')
    await user.click(checkerOptions[checkerOptions.length - 1])

    await user.click(screen.getByText(/Save Container/i))

    await user.click(screen.getByText(/Create Dispatch/i))
    await screen.findByText(/Confirm Submission/i)
    fireEvent.click(screen.getByText('Continue'))

    await waitFor(() => {
      expect(createDispatch).toHaveBeenCalled()
      expect(onCreated).toHaveBeenCalled()
    })
  })
})
