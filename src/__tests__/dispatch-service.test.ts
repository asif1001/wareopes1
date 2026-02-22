import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/firebase/firebase', () => ({
  app: {},
  db: {},
  storage: {},
}))

const addDoc = vi.fn(async () => ({ id: 'd1' }))
const getDoc = vi.fn(async () => ({
  id: 'd1',
  data: () => ({
    dateTime: new Date('2024-01-10T10:00:00Z'),
    invoiceNo: 'INV-1',
    customerName: 'Customer',
    customerCode: 'C1',
    loadingDate: new Date('2024-01-11T10:00:00Z'),
    containerSize: '20ft',
    noOfContainer: 1,
    noOfCases: 10,
    photos: [],
    trailerNo: 'TR-1',
    driverCprNo: 'CPR-1',
    driverPhoneNo: '123456789',
    containerNo: 'CONT-1',
    loaderName: 'Loader',
    checkerName: 'Checker',
    modeOfTransport: 'Road',
    status: 'Pending',
    createdAt: new Date('2024-01-10T10:00:00Z'),
    updatedAt: new Date('2024-01-10T10:00:00Z'),
  }),
  exists: () => true,
}))
const updateDoc = vi.fn(async () => {})
const collection = vi.fn(() => 'dispatches-col')
const doc = vi.fn(() => 'dispatches-doc')
const serverTimestamp = vi.fn(() => 'server-ts')

vi.mock('firebase/firestore', () => ({
  addDoc,
  getDoc,
  updateDoc,
  collection,
  doc,
  serverTimestamp,
  getDocs: vi.fn(async () => ({ docs: [] })),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  writeBatch: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'u1' } }),
  signInAnonymously: vi.fn(),
  onAuthStateChanged: (_auth: any, cb: any) => {
    setTimeout(() => cb(), 0)
    return () => {}
  },
}))

describe('DispatchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates dispatch and returns serialized data', async () => {
    const { DispatchService } = await import('@/lib/firebase/firestore')
    const result = await DispatchService.createDispatch({
      dateTime: new Date('2024-01-10T10:00:00Z').toISOString(),
      invoiceNo: 'INV-1',
      customerName: 'Customer',
      customerCode: 'C1',
      loadingDate: new Date('2024-01-11T10:00:00Z').toISOString(),
      containerSize: '20ft',
      noOfContainer: 1,
      noOfCases: 10,
      photos: [],
      trailerNo: 'TR-1',
      driverCprNo: 'CPR-1',
      driverPhoneNo: '123456789',
      containerNo: 'CONT-1',
      loaderName: 'Loader',
      checkerName: 'Checker',
      modeOfTransport: 'Road',
      status: 'Pending',
    } as any)

    expect(addDoc).toHaveBeenCalled()
    expect(getDoc).toHaveBeenCalled()
    expect(result.id).toBe('d1')
    expect(result.invoiceNo).toBe('INV-1')
    expect(result.dateTime).toContain('2024-01-10')
  })

  it('updates dispatch and returns serialized data', async () => {
    const { DispatchService } = await import('@/lib/firebase/firestore')
    const result = await DispatchService.updateDispatch('d1', {
      status: 'Loaded',
      loadingDate: new Date('2024-01-12T10:00:00Z').toISOString(),
    } as any)

    expect(updateDoc).toHaveBeenCalled()
    expect(getDoc).toHaveBeenCalled()
    expect(result.id).toBe('d1')
  })
})
