import { app, db } from './firebase';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, query, where, serverTimestamp, orderBy, limit, writeBatch, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import type { Shipment, User, Source, ContainerSize, Department, Branch, ContainerBooking, ClearedContainerSummary, ClearedShipmentSummary, Role, SerializableShipment, SerializableDispatch } from '@/lib/types';
import { format, parse, compareAsc, subDays, subYears, getWeek, getYear } from 'date-fns';

// Helper to convert Firestore/Admin Timestamps to ISO strings for serialization
const toISOString = (timestamp: any): string | undefined => {
    if (timestamp && typeof timestamp.toDate === 'function') {
        try { return timestamp.toDate().toISOString(); } catch { return undefined; }
    }
    if (timestamp instanceof Date) {
        return timestamp.toISOString();
    }
    if (typeof timestamp === 'string') {
        return timestamp;
    }
    return undefined;
};

export async function ensureClientAuth() {
    if (typeof window === 'undefined') return;
    const auth = getAuth(app);
    if (!auth.currentUser) {
        try {
            await signInAnonymously(auth);
        } catch {}
    }
    const authStateReady = (auth as any).authStateReady;
    if (typeof authStateReady === 'function') {
        await authStateReady.call(auth);
        return;
    }
    await new Promise<void>((resolve) => {
        const unsub = onAuthStateChanged(auth, () => {
            unsub();
            resolve();
        });
    });
}

function docToShipment(doc: any): SerializableShipment {
        const data = typeof doc.data === 'function' ? doc.data() : doc; // support admin and client snapshots
  
    const bookings = data.bookings?.map((b: any) => ({
        ...b,
        bookingDate: toISOString(b.bookingDate)
    })) || [];

        return {
            id: doc.id || data.id,
      source: data.source,
      invoice: data.invoice,
      billOfLading: data.billOfLading,
      numContainers: data.numContainers,
      containers: data.containers,
      // Status & Branch
      status: (data.status as any) || 'Not Arrived',
      branch: data.branch || undefined,
      bahrainEta: toISOString(data.bahrainEta)!,
      originalDocumentReceiptDate: toISOString(data.originalDocumentReceiptDate) || null,
      actualBahrainEta: toISOString(data.actualBahrainEta) || null,
      lastStorageDay: toISOString(data.lastStorageDay) || null,
      whEtaRequestedByParts: toISOString(data.whEtaRequestedByParts) || null,
      whEtaConfirmedByLogistics: toISOString(data.whEtaConfirmedByLogistics) || null,
      cleared: data.cleared,
      actualClearedDate: toISOString(data.actualClearedDate) || null,
      totalCases: data.totalCases,
      domLines: data.domLines,
      bulkLines: data.bulkLines,
      totalLines: data.totalLines,
      generalRemark: data.generalRemark,
      remark: data.remark,
      bookings: bookings,
      monthYear: data.monthYear,
      createdAt: toISOString(data.createdAt)!,
      updatedAt: toISOString(data.updatedAt)!,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      productionUploaded: !!data.productionUploaded,
    };
}

export async function getShipments(): Promise<SerializableShipment[]> {
    // Server-side: use Admin SDK to bypass Firestore rules
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const shipmentsRef: any = adb.collection('shipments');
        const fortyFiveDaysAgo = new Date();
        fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
        const snap = await shipmentsRef
            .where('bahrainEta', '>=', fortyFiveDaysAgo)
            .orderBy('bahrainEta', 'desc')
            .get();
        return snap.docs.map((d: any) => docToShipment(d));
    }

    const shipmentsCol = collection(db, 'shipments');
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
    
    const q = query(
        shipmentsCol, 
        where("bahrainEta", ">=", fortyFiveDaysAgo),
        orderBy("bahrainEta", "desc")
    );
    const shipmentSnapshot = await getDocs(q);
    return shipmentSnapshot.docs.map(docToShipment);
}

export async function getShipmentsByDateRange(from: Date, to: Date): Promise<SerializableShipment[]> {
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const shipmentsRef: any = adb.collection('shipments');
        const snap = await shipmentsRef
            .where('bahrainEta', '>=', from)
            .where('bahrainEta', '<=', to)
            .orderBy('bahrainEta', 'asc')
            .get();
        return snap.docs.map((d: any) => docToShipment(d));
    }

    const shipmentsCol = collection(db, 'shipments');
    const q = query(
        shipmentsCol,
        where("bahrainEta", ">=", from),
        where("bahrainEta", "<=", to),
        orderBy("bahrainEta", "asc")
    );
    const shipmentSnapshot = await getDocs(q);
    return shipmentSnapshot.docs.map(docToShipment);
}




export async function addShipment(shipment: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt' | 'bookings'>) {
    const baseData: any = {
        ...shipment,
        invoice: shipment.invoice.toUpperCase(),
        billOfLading: shipment.billOfLading.toUpperCase(),
        source: shipment.source.toUpperCase(),
    };
    const serverData: any = { ...baseData, createdAt: new Date(), updatedAt: new Date() };
    const clientData: any = { ...baseData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    if (shipment.cleared && shipment.actualClearedDate) {
        const m = format(shipment.actualClearedDate, 'MMM yy');
        serverData.monthYear = m;
        clientData.monthYear = m;
    }
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        await adb.collection('shipments').add(serverData);
        return;
    }
    await addDoc(collection(db, 'shipments'), clientData);
}

export async function bulkAddShipments(shipments: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt' | 'bookings'>[]) {
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const batch = adb.batch();
        const shipmentsCol = adb.collection('shipments');
        for (const shipment of shipments) {
            const shipmentData: any = {
                ...shipment,
                invoice: shipment.invoice.toUpperCase(),
                billOfLading: shipment.billOfLading.toUpperCase(),
                source: shipment.source.toUpperCase(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            if (shipment.cleared && shipment.actualClearedDate) {
                shipmentData.monthYear = format(shipment.actualClearedDate, 'MMM yy');
            }
            const newDocRef = shipmentsCol.doc();
            batch.set(newDocRef, shipmentData);
        }
        await batch.commit();
        return;
    }
    const batch = writeBatch(db);
    const shipmentsCol = collection(db, 'shipments');
    for (const shipment of shipments) {
        const shipmentData: any = {
            ...shipment,
            invoice: shipment.invoice.toUpperCase(),
            billOfLading: shipment.billOfLading.toUpperCase(),
            source: shipment.source.toUpperCase(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        if (shipment.cleared && shipment.actualClearedDate) {
            shipmentData.monthYear = format(shipment.actualClearedDate, 'MMM yy');
        }
        const newDocRef = doc(shipmentsCol);
        batch.set(newDocRef, shipmentData);
    }
    await batch.commit();
}


export async function updateShipment(id: string, shipment: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt' | 'bookings'>>) {
    const baseUpdate: any = {
        ...shipment,
        ...(shipment.invoice && { invoice: shipment.invoice.toUpperCase() }),
        ...(shipment.billOfLading && { billOfLading: shipment.billOfLading.toUpperCase() }),
        ...(shipment.source && { source: shipment.source.toUpperCase() }),
    };
    if (shipment.cleared && shipment.actualClearedDate) {
        baseUpdate.monthYear = format(shipment.actualClearedDate, 'MMM yy');
    } else if (shipment.cleared === false) {
        baseUpdate.monthYear = null;
    }
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        await adb.collection('shipments').doc(id).update({
            ...baseUpdate,
            updatedAt: new Date(),
        });
        return;
    }
    await updateDoc(doc(db, 'shipments', id), { ...baseUpdate, updatedAt: serverTimestamp() });
}

export async function updateShipmentBookings(id: string, bookings: ContainerBooking[]) {
    const clearedDate = new Date();
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        await adb.collection('shipments').doc(id).update({
            bookings,
            cleared: true,
            status: 'Arrived',
            actualClearedDate: clearedDate,
            actualBahrainEta: clearedDate,
            monthYear: format(clearedDate, 'MMM yy'),
            updatedAt: new Date(),
        });
        return;
    }
    await updateDoc(doc(db, 'shipments', id), {
        bookings,
        cleared: true,
        status: 'Arrived',
        actualClearedDate: clearedDate,
        actualBahrainEta: clearedDate,
        monthYear: format(clearedDate, 'MMM yy'),
        updatedAt: serverTimestamp(),
    });
}

export async function updateShipmentBookingsOnly(id: string, bookings: ContainerBooking[]) {
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        await adb.collection('shipments').doc(id).update({
            bookings,
            updatedAt: new Date(),
        });
        return;
    }
    await updateDoc(doc(db, 'shipments', id), {
        bookings,
        updatedAt: serverTimestamp(),
    });
}

// User Functions
export async function getUsers(): Promise<User[]> {
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const [usersSnap, rolesSnap] = await Promise.all([
          adb.collection('Users').get(),
          adb.collection('Roles').get()
        ]);
        const roleMap = new Map<string, any>();
        rolesSnap.docs.forEach((d: any) => {
          const data = d.data ? d.data() : d;
          roleMap.set(String(data?.name || ''), data);
        });
        return usersSnap.docs.map((d: any) => {
          const raw = (d.data ? d.data() : d) as any;
          let permissions = raw?.permissions as any | undefined;
          if (!permissions && raw?.role) {
            const role = roleMap.get(String(raw.role));
            const arr = Array.isArray(role?.permissions) ? role.permissions : [];
            const normalized: any = {};
            for (const item of arr) {
              if (typeof item !== 'string') continue;
              const [page, action] = item.split(':');
              if (!page || !action) continue;
              (normalized[page] ||= []).push(action);
            }
            permissions = Object.keys(normalized).length ? normalized : undefined;
          }
          return { 
              id: d.id, 
              ...raw, 
              createdAt: toISOString(raw.createdAt), 
              updatedAt: toISOString(raw.updatedAt), 
              ...(permissions ? { permissions } : {}) 
          } as User;
        });
    }
    await ensureClientAuth();
    const [usersSnap, rolesSnap] = await Promise.all([
      getDocs(collection(db, 'Users')),
      getDocs(collection(db, 'Roles'))
    ]);
    const roleMap = new Map<string, any>();
    rolesSnap.docs.forEach((d: any) => {
      const data = d.data();
      roleMap.set(String(data?.name || ''), data);
    });
    return usersSnap.docs.map(doc => {
      const raw = doc.data() as any;
      let permissions = raw?.permissions as any | undefined;
      if (!permissions && raw?.role) {
        const role = roleMap.get(String(raw.role));
        const arr = Array.isArray(role?.permissions) ? role.permissions : [];
        const normalized: any = {};
        for (const item of arr) {
          if (typeof item !== 'string') continue;
          const [page, action] = item.split(':');
          if (!page || !action) continue;
          (normalized[page] ||= []).push(action);
        }
        permissions = Object.keys(normalized).length ? normalized : undefined;
      }
      return { 
          id: doc.id, 
          ...raw, 
          createdAt: toISOString(raw.createdAt), 
          updatedAt: toISOString(raw.updatedAt), 
          ...(permissions ? { permissions } : {}) 
      } as User;
    });
}

export async function getUserByEmployeeNo(employeeNo: string): Promise<User | null> {
    return withRetry(async () => {
        const tryQuery = async (colName: string, value: string | number) => {
            const usersCol = collection(db, colName);
            const q = query(usersCol, where('employeeNo', '==', value));
            return await getDocs(q);
        };

        const maybeNum = Number(employeeNo);
        const candidates: Array<{ col: string; val: string | number }> = [
            { col: 'Users', val: employeeNo },
            ...(Number.isNaN(maybeNum) ? [] : [{ col: 'Users', val: maybeNum }]),
            { col: 'users', val: employeeNo },
            ...(Number.isNaN(maybeNum) ? [] : [{ col: 'users', val: maybeNum }]),
        ];

        for (const c of candidates) {
            try {
                const snapshot = await tryQuery(c.col, c.val);
                if (!snapshot.empty) {
                    const userDoc = snapshot.docs[0];
                    const raw = userDoc.data() as any;
                    // If explicit permissions are absent, hydrate from Role permissions
                    if (!raw?.permissions && raw?.role) {
                        const rolesSnap = await getDocs(query(collection(db, 'Roles'), where('name', '==', String(raw.role))));
                        if (!rolesSnap.empty) {
                            const roleData = rolesSnap.docs[0].data() as any;
                            const arr = Array.isArray(roleData?.permissions) ? roleData.permissions : [];
                            const normalized: any = {};
                            for (const item of arr) {
                                if (typeof item !== 'string') continue;
                                const [page, action] = item.split(':');
                                if (!page || !action) continue;
                                (normalized[page] ||= []).push(action);
                            }
                            if (Object.keys(normalized).length) raw.permissions = normalized;
                        }
                    }
                    return { id: userDoc.id, ...raw } as User;
                }
            } catch {
                // ignore and continue to next candidate
            }
        }

        return null;
    });
}

export async function addUser(user: Omit<User, 'id'>) {
    await addDoc(collection(db, 'Users'), user);
}

export async function updateUser(id: string, user: Partial<User>) {
    await updateDoc(doc(db, 'Users', id), user);
}

export async function deleteUser(id: string) {
    await deleteDoc(doc(db, 'Users', id));
}

// Source Functions
export async function getSources(): Promise<Source[]> {
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const snap = await adb.collection('Sources').get();
        return snap.docs.map((d: any) => ({ id: d.id, ...(d.data ? d.data() : d) } as Source));
    }
    await ensureClientAuth();
    const sourcesCol = collection(db, 'Sources');
    const sourceSnapshot = await getDocs(sourcesCol);
    return sourceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Source));
}

export async function addSource(source: Omit<Source, 'id'>) {
    await addDoc(collection(db, 'Sources'), source);
}

export async function updateSource(id: string, source: Partial<Source>) {
    await updateDoc(doc(db, 'Sources', id), source);
}

export async function deleteSource(id: string) {
    await deleteDoc(doc(db, 'Sources', id));
}

// ContainerSize Functions
export async function getContainerSizes(): Promise<ContainerSize[]> {
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const snap = await adb.collection('ContainerSizes').get();
        return snap.docs.map((d: any) => {
            const data = d.data ? d.data() : d;
            return { 
                id: d.id, 
                ...data, 
                createdAt: toISOString(data.createdAt), 
                updatedAt: toISOString(data.updatedAt) 
            } as ContainerSize;
        });
    }
    await ensureClientAuth();
    const sizesCol = collection(db, 'ContainerSizes');
    const sizeSnapshot = await getDocs(sizesCol);
    return sizeSnapshot.docs.map(doc => {
        const data = doc.data() as Omit<ContainerSize, 'id'>;
        return { 
            id: doc.id, 
            ...data, 
            createdAt: toISOString(data.createdAt), 
            updatedAt: toISOString(data.updatedAt) 
        };
    });
}

export async function addContainerSize(containerSize: Omit<ContainerSize, 'id'>) {
    const docRef = await addDoc(collection(db, 'ContainerSizes'), containerSize);
    return { id: docRef.id, ...containerSize };
}

export async function updateContainerSize(id: string, containerSize: Partial<ContainerSize>) {
    await updateDoc(doc(db, 'ContainerSizes', id), containerSize);
}

export async function deleteContainerSize(id: string) {
    await deleteDoc(doc(db, 'ContainerSizes', id));
}

// Department Functions
export async function getDepartments(): Promise<Department[]> {
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const snap = await adb.collection('Departments').get();
        return snap.docs.map((d: any) => ({ id: d.id, ...(d.data ? d.data() : d) } as Department));
    }
    await ensureClientAuth();
    const departmentsCol = collection(db, 'Departments');
    const departmentSnapshot = await getDocs(departmentsCol);
    return departmentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
}

export async function addDepartment(department: Omit<Department, 'id'>) {
    await addDoc(collection(db, 'Departments'), department);
}

export async function updateDepartment(id: string, department: Partial<Department>) {
    await updateDoc(doc(db, 'Departments', id), department);
}

export async function deleteDepartment(id: string) {
    await deleteDoc(doc(db, 'Departments', id));
}

// Branch Functions
export async function getBranches(): Promise<Branch[]> {
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        try {
            const snap = await adb.collection('branches').get();
            if (!snap.empty) return snap.docs.map((d: any) => ({ id: d.id, ...(d.data ? d.data() : d) } as Branch));
        } catch {}
        const snap2 = await adb.collection('Branches').get();
        return snap2.docs.map((d: any) => ({ id: d.id, ...(d.data ? d.data() : d) } as Branch));
    }
    await ensureClientAuth();
    try {
        const branchesCol = collection(db, 'branches');
        const branchSnapshot = await getDocs(branchesCol);
        if (!branchSnapshot.empty) return branchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
    } catch {}
    const branchesCol2 = collection(db, 'Branches');
    const branchSnapshot2 = await getDocs(branchesCol2);
    return branchSnapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
}

export async function addBranch(branch: Omit<Branch, 'id'>) {
    await addDoc(collection(db, 'Branches'), branch);
}

export async function updateBranch(id: string, branch: Partial<Branch>) {
    await updateDoc(doc(db, 'Branches', id), branch);
}

export async function deleteBranch(id: string) {
    await deleteDoc(doc(db, 'Branches', id));
}

// Roles Functions
export async function getRoles(): Promise<Role[]> {
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const snap = await adb.collection('Roles').get();
        return snap.docs.map((d: any) => ({ id: d.id, ...(d.data ? d.data() : d) } as Role));
    }
    await ensureClientAuth();
    const rolesCol = collection(db, 'Roles');
    const rolesSnapshot = await getDocs(rolesCol);
    return rolesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
}

export async function addRole(role: Omit<Role, 'id'>) {
    const docRef = await addDoc(collection(db, 'Roles'), role);
    return { id: docRef.id, ...role } as Role;
}

export async function deleteRole(id: string) {
    await deleteDoc(doc(db, 'Roles', id));
}

// Vehicle Functions
// These helpers persist vehicles to Firestore in a "vehicles" collection.
// Shape aligns with the Maintenance page's Vehicle type.

function docToDispatch(doc: any): SerializableDispatch {
    const data = typeof doc.data === 'function' ? doc.data() : doc;

    const normalizeContainerPhotos = (photos: any[] | undefined) => {
        if (!Array.isArray(photos)) return [];
        return photos.map((p) => {
            if (typeof p === "string") {
                return {
                    fileName: p.split("/").pop() || "photo",
                    storagePath: "",
                    downloadURL: p,
                    uploadedAt: toISOString(data.createdAt) || ""
                };
            }
            return {
                fileName: p.fileName || '',
                storagePath: p.storagePath || '',
                downloadURL: p.downloadURL || p.url || '',
                uploadedAt: toISOString(p.uploadedAt) || toISOString(data.createdAt) || ''
            };
        }).filter((p) => p.downloadURL);
    };

    const normalizeContainer = (container: any, fallbackId: string): any => ({
        containerId: container.containerId || fallbackId,
        containerNumber: container.containerNumber || container.containerNo || data.containerNo || '',
        containerSize: container.containerSize || data.containerSize || '',
        bookingNumber: container.bookingNumber || container.bookingNo || data.bookingNumber || data.bookingNo || '',
        bookingDate: toISOString(container.bookingDate) || toISOString(data.loadingDate) || toISOString(data.dateTime) || '',
        numberOfCases: Number(container.numberOfCases ?? data.noOfCases ?? 0),
        status: container.status || data.status || 'Pending',
        inspectionRemark: container.inspectionRemark || container.containerInspectionRemark || data.containerInspectionRemark || '',
        transport: {
            modeOfTransport: container.transport?.modeOfTransport || container.modeOfTransport || data.modeOfTransport || 'Road',
            trailerNumber: container.transport?.trailerNumber || container.trailerNumber || data.trailerNo || '',
            driverCPR: container.transport?.driverCPR || container.driverCPR || data.driverCprNo || '',
            driverPhone: container.transport?.driverPhone || container.driverPhone || data.driverPhoneNo || '',
            driverName: container.transport?.driverName || container.driverName || '',
        },
        personnel: {
            loaderName: container.personnel?.loaderName || container.loaderName || data.loaderName || '',
            checkerName: container.personnel?.checkerName || container.checkerName || data.checkerName || '',
        },
        photos: normalizeContainerPhotos(container.photos) || normalizeContainerPhotos(data.photos),
    });

    const containersFromDoc = Array.isArray(data.containers) && data.containers.length > 0
        ? data.containers.map((container: any, index: number) => normalizeContainer(container, `${doc.id || data.id}-c${index + 1}`))
        : (data.containerNo || data.containerSize || data.noOfCases || data.photos || data.trailerNo)
            ? [normalizeContainer({}, `${doc.id || data.id}-legacy`)]
            : [];

    return {
        id: doc.id || data.id,
        dateTime: toISOString(data.dateTime)!,
        invoiceNo: data.invoiceNo,
        customerName: data.customerName,
        customerCode: data.customerCode,
        containers: containersFromDoc.length > 0 ? containersFromDoc : undefined,
        loadingDate: toISOString(data.loadingDate),
        containerSize: data.containerSize,
        noOfContainer: data.noOfContainer,
        noOfCases: data.noOfCases,
        photos: data.photos || [],
        containerInspectionRemark: data.containerInspectionRemark,
        trailerNo: data.trailerNo,
        driverCprNo: data.driverCprNo,
        driverPhoneNo: data.driverPhoneNo,
        containerNo: data.containerNo,
        loaderName: data.loaderName,
        checkerName: data.checkerName,
        modeOfTransport: data.modeOfTransport,
        status: data.status || 'Pending',
        createdAt: toISOString(data.createdAt)!,
        updatedAt: toISOString(data.updatedAt)!,
    };
}

function normalizeDispatchDates(input: Partial<SerializableDispatch>) {
    const dateTime = input.dateTime ? new Date(input.dateTime) : undefined;
    const loadingDate = input.loadingDate ? new Date(input.loadingDate) : undefined;
    const containers = Array.isArray(input.containers)
        ? input.containers.map((container: any) => {
            const bookingDate = container.bookingDate ? new Date(container.bookingDate) : undefined;
            const photos = Array.isArray(container.photos)
                ? container.photos.map((p: any) => ({
                    ...p,
                    uploadedAt: p.uploadedAt ? new Date(p.uploadedAt) : p.uploadedAt
                }))
                : undefined;
            return {
                ...container,
                ...(bookingDate ? { bookingDate } : {}),
                ...(photos ? { photos } : {})
            };
        })
        : undefined;
    return { ...input, ...(dateTime ? { dateTime } : {}), ...(loadingDate ? { loadingDate } : {}), ...(containers ? { containers } : {}) };
}

export async function getDispatches(): Promise<SerializableDispatch[]> {
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const dispatchesRef: any = adb.collection('dispatches');
        const snap = await dispatchesRef.orderBy('dateTime', 'desc').get();
        return snap.docs.map((d: any) => docToDispatch(d));
    }

    await ensureClientAuth();
    const dispatchesCol = collection(db, 'dispatches');
    const q = query(dispatchesCol, orderBy("dateTime", "desc"));
    const dispatchSnapshot = await getDocs(q);
    return dispatchSnapshot.docs.map(docToDispatch);
}

export async function getDispatch(id: string): Promise<SerializableDispatch | null> {
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const snap = await adb.collection('dispatches').doc(id).get();
        if (!snap.exists) return null;
        return docToDispatch(snap);
    }
    await ensureClientAuth();
    const snap = await getDoc(doc(db, 'dispatches', id));
    if (!snap.exists()) return null;
    return docToDispatch(snap);
}

export async function createDispatch(dispatch: Omit<SerializableDispatch, 'id' | 'createdAt' | 'updatedAt'>): Promise<SerializableDispatch> {
    const normalized = normalizeDispatchDates(dispatch);
    const payload: any = {
        ...normalized,
        status: normalized.status || 'Pending',
    };
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const ref = await adb.collection('dispatches').add({ ...payload, createdAt: new Date(), updatedAt: new Date() });
        const snap = await adb.collection('dispatches').doc(ref.id).get();
        return docToDispatch(snap);
    }
    await ensureClientAuth();
    const ref = await addDoc(collection(db, 'dispatches'), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    const snap = await getDoc(doc(db, 'dispatches', ref.id));
    return docToDispatch(snap);
}

export async function updateDispatch(id: string, dispatch: Partial<Omit<SerializableDispatch, 'id' | 'createdAt' | 'updatedAt'>>): Promise<SerializableDispatch> {
    const normalized = normalizeDispatchDates(dispatch);
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        await adb.collection('dispatches').doc(id).update({ ...normalized, updatedAt: new Date() });
        const snap = await adb.collection('dispatches').doc(id).get();
        return docToDispatch(snap);
    }
    await ensureClientAuth();
    await updateDoc(doc(db, 'dispatches', id), { ...normalized, updatedAt: serverTimestamp() });
    const snap = await getDoc(doc(db, 'dispatches', id));
    return docToDispatch(snap);
}

export async function addDispatch(dispatch: Omit<SerializableDispatch, 'id' | 'createdAt' | 'updatedAt' | 'photos' | 'status'>) {
    return createDispatch(dispatch as Omit<SerializableDispatch, 'id' | 'createdAt' | 'updatedAt'>);
}

export const DispatchService = {
    createDispatch,
    updateDispatch,
    getDispatch,
    listDispatches: getDispatches,
};




export async function getVehicles(): Promise<any[]> {
    const snap = await getDocs(collection(db, 'vehicles'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

export async function addVehicle(vehicle: any): Promise<{ id: string } & any> {
    // Normalize minimal fields
    const payload: any = {
        ...vehicle,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'vehicles'), payload);
    return { id: ref.id, ...vehicle };
}

export async function updateVehicle(id: string, vehicle: Partial<any>): Promise<void> {
    const payload: any = { ...vehicle, updatedAt: serverTimestamp() };
    await updateDoc(doc(db, 'vehicles', id), payload);
}

export async function deleteVehicle(id: string): Promise<void> {
    await deleteDoc(doc(db, 'vehicles', id));
}


// ...

export async function getWipShipments(): Promise<SerializableShipment[]> {
    // Server-side: use Admin SDK to bypass Firestore rules
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const shipmentsRef: any = adb.collection('shipments');
        const snap = await shipmentsRef
            .where('status', '==', 'WIP')
            .get();
        const docs = snap.docs.map((d: any) => docToShipment(d));
        // Sort by bahrainEta desc by default
        return docs.sort((a: any, b: any) => new Date(b.bahrainEta).getTime() - new Date(a.bahrainEta).getTime());
    }

    const shipmentsCol = collection(db, 'shipments');
    const q = query(
        shipmentsCol,
        where('status', '==', 'WIP')
    );
    const shipmentSnapshot = await getDocs(q);
    const docs = shipmentSnapshot.docs.map(docToShipment);
    return docs.sort((a: any, b: any) => new Date(b.bahrainEta).getTime() - new Date(a.bahrainEta).getTime());
}

export async function getUpcomingShipments(): Promise<SerializableShipment[]> {
    try {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const fifteenDaysAgo = subDays(new Date(), 15);
        fifteenDaysAgo.setHours(0, 0, 0, 0);

        if (typeof window === 'undefined') {
            const { getAdminDb } = await import('./admin');
            const adb = await getAdminDb();
            const shipmentsRef: any = adb.collection('shipments');
            const snap = await shipmentsRef
                .where('actualClearedDate', '>=', fifteenDaysAgo)
                .where('actualClearedDate', '<=', today)
                .orderBy('actualClearedDate', 'desc')
                .get();
            return snap.docs.map((d: any) => docToShipment(d));
        }

        const shipmentsCol = collection(db, 'shipments');
        const q = query(
            shipmentsCol,
            where('actualClearedDate', '>=', fifteenDaysAgo),
            where('actualClearedDate', '<=', today),
            orderBy('actualClearedDate', 'desc')
        );
        const shipmentSnapshot = await getDocs(q);
        return shipmentSnapshot.docs.map(docToShipment);
    } catch (e) {
        return [];
    }
}

// Helper to format week label (e.g. "W1 2024")
const formatWeek = (date: Date) => {
    const week = getWeek(date);
    const year = getYear(date);
    return `W${week} ${year}`;
};

export async function getClearedShipmentsMonthlySummary(): Promise<ClearedShipmentSummary> {
    try {
        const fiveYearsAgo = subYears(new Date(), 5);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        let docs: any[] = [];
        if (typeof window === 'undefined') {
            const { getAdminDb } = await import('./admin');
            const adb = await getAdminDb();
            const snap = await adb
                .collection('shipments')
                .where('actualClearedDate', '>=', fiveYearsAgo)
                .where('actualClearedDate', '<=', today)
                .get();
            docs = snap.docs;
        } else {
            const shipmentsCol = collection(db, 'shipments');
            const qy = query(
                shipmentsCol,
                where('actualClearedDate', '>=', fiveYearsAgo),
                where('actualClearedDate', '<=', today)
            );
            const shipmentSnapshot = await getDocs(qy);
            docs = shipmentSnapshot.docs;
        }

        const monthlySummary: Record<string, { domLines: number; bulkLines: number }> = {};
        const weeklySummary: Record<string, { domLines: number; bulkLines: number }> = {};
        const yearlySummary: Record<string, { domLines: number; bulkLines: number }> = {};
        const sourceSummary: Record<string, number> = {};
        const bySource = {
            monthly: {} as Record<string, Record<string, { domLines: number; bulkLines: number }>>,
            weekly: {} as Record<string, Record<string, { domLines: number; bulkLines: number }>>,
            yearly: {} as Record<string, Record<string, { domLines: number; bulkLines: number }>>
        };

        docs.forEach((doc: any) => {
            const data = typeof doc.data === 'function' ? doc.data() : doc;
            const clearedDate = data.actualClearedDate?.toDate();

            if (clearedDate) {
                const dom = Number(data.domLines || 0);
                const bulk = Number(data.bulkLines || 0);
                const total = dom + bulk;
                const source = data.source || 'Unknown';
                
                sourceSummary[source] = (sourceSummary[source] ?? 0) + total;

                // Month
                const monthKey = format(clearedDate, "MMM yy");
                if (!monthlySummary[monthKey]) monthlySummary[monthKey] = { domLines: 0, bulkLines: 0 };
                monthlySummary[monthKey].domLines += dom;
                monthlySummary[monthKey].bulkLines += bulk;
                
                if (!bySource.monthly[source]) bySource.monthly[source] = {};
                if (!bySource.monthly[source][monthKey]) bySource.monthly[source][monthKey] = { domLines: 0, bulkLines: 0 };
                bySource.monthly[source][monthKey].domLines += dom;
                bySource.monthly[source][monthKey].bulkLines += bulk;

                // Week
                const weekKey = formatWeek(clearedDate);
                if (!weeklySummary[weekKey]) weeklySummary[weekKey] = { domLines: 0, bulkLines: 0 };
                weeklySummary[weekKey].domLines += dom;
                weeklySummary[weekKey].bulkLines += bulk;

                if (!bySource.weekly[source]) bySource.weekly[source] = {};
                if (!bySource.weekly[source][weekKey]) bySource.weekly[source][weekKey] = { domLines: 0, bulkLines: 0 };
                bySource.weekly[source][weekKey].domLines += dom;
                bySource.weekly[source][weekKey].bulkLines += bulk;

                // Year
                const yearKey = String(getYear(clearedDate));
                if (!yearlySummary[yearKey]) yearlySummary[yearKey] = { domLines: 0, bulkLines: 0 };
                yearlySummary[yearKey].domLines += dom;
                yearlySummary[yearKey].bulkLines += bulk;

                if (!bySource.yearly[source]) bySource.yearly[source] = {};
                if (!bySource.yearly[source][yearKey]) bySource.yearly[source][yearKey] = { domLines: 0, bulkLines: 0 };
                bySource.yearly[source][yearKey].domLines += dom;
                bySource.yearly[source][yearKey].bulkLines += bulk;
            }
        });

        const sortMonths = (keys: string[]) => keys.sort((a, b) => compareAsc(parse(a, 'MMM yy', new Date()), parse(b, 'MMM yy', new Date())));
        const sortWeeks = (keys: string[]) => keys.sort((a, b) => {
             const [wa, ya] = a.replace('W', '').split(' ');
             const [wb, yb] = b.replace('W', '').split(' ');
             if (ya !== yb) return Number(ya) - Number(yb);
             return Number(wa) - Number(wb);
        });
        const sortYears = (keys: string[]) => keys.sort();

        const monthlyData = sortMonths(Object.keys(monthlySummary)).map(m => ({ month: m, ...monthlySummary[m] }));
        const weeklyData = sortWeeks(Object.keys(weeklySummary)).map(w => ({ week: w, ...weeklySummary[w] }));
        const yearlyData = sortYears(Object.keys(yearlySummary)).map(y => ({ year: y, ...yearlySummary[y] }));

        const bySourceMonthly: any = {};
        Object.entries(bySource.monthly).forEach(([src, map]) => {
            bySourceMonthly[src] = sortMonths(Object.keys(map)).map(m => ({ month: m, ...map[m] }));
        });

        const bySourceWeekly: any = {};
        Object.entries(bySource.weekly).forEach(([src, map]) => {
            bySourceWeekly[src] = sortWeeks(Object.keys(map)).map(w => ({ week: w, ...map[w] }));
        });

        const bySourceYearly: any = {};
        Object.entries(bySource.yearly).forEach(([src, map]) => {
            bySourceYearly[src] = sortYears(Object.keys(map)).map(y => ({ year: y, ...map[y] }));
        });

        return {
            monthlyData,
            weeklyData,
            yearlyData,
            sourceData: sourceSummary,
            bySource: {
                monthly: bySourceMonthly,
                weekly: bySourceWeekly,
                yearly: bySourceYearly
            },
            monthlyBySource: bySourceMonthly
        };
    } catch (e) {
        return { monthlyData: [], weeklyData: [], yearlyData: [], sourceData: {}, bySource: { monthly: {}, weekly: {}, yearly: {} } };
    }
}

export async function getClearedContainerSummary(): Promise<ClearedContainerSummary> {
    try {
        const fiveYearsAgo = subYears(new Date(), 5);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        let docs: any[] = [];
        if (typeof window === 'undefined') {
            const { getAdminDb } = await import('./admin');
            const adb = await getAdminDb();
            const snap = await adb
                .collection('shipments')
                .where('actualClearedDate', '>=', fiveYearsAgo)
                .where('actualClearedDate', '<=', today)
                .get();
            docs = snap.docs;
        } else {
            const shipmentsCol = collection(db, 'shipments');
            const qy = query(
                shipmentsCol,
                where('actualClearedDate', '>=', fiveYearsAgo),
                where('actualClearedDate', '<=', today)
            );
            const shipmentSnapshot = await getDocs(qy);
            docs = shipmentSnapshot.docs;
        }

        const monthlySummary: Record<string, number> = {};
        const weeklySummary: Record<string, number> = {};
        const yearlySummary: Record<string, number> = {};
        const sourceSummary: Record<string, number> = {};
        const bySource = {
            monthly: {} as Record<string, Record<string, number>>,
            weekly: {} as Record<string, Record<string, number>>,
            yearly: {} as Record<string, Record<string, number>>
        };
        let totalContainers = 0;

        docs.forEach((doc: any) => {
            const data = typeof doc.data === 'function' ? doc.data() : doc;
            const clearedDate = data.actualClearedDate?.toDate();

            if (clearedDate && data.bookings && data.bookings.length > 0) {
                const numContainersInShipment = data.bookings.length;
                const source = data.source || 'Unknown';
                
                sourceSummary[source] = (sourceSummary[source] ?? 0) + numContainersInShipment;
                totalContainers += numContainersInShipment;

                // Month
                const monthKey = format(clearedDate, "MMM yy");
                monthlySummary[monthKey] = (monthlySummary[monthKey] ?? 0) + numContainersInShipment;
                
                if (!bySource.monthly[source]) bySource.monthly[source] = {};
                bySource.monthly[source][monthKey] = (bySource.monthly[source][monthKey] ?? 0) + numContainersInShipment;

                // Week
                const weekKey = formatWeek(clearedDate);
                weeklySummary[weekKey] = (weeklySummary[weekKey] ?? 0) + numContainersInShipment;

                if (!bySource.weekly[source]) bySource.weekly[source] = {};
                bySource.weekly[source][weekKey] = (bySource.weekly[source][weekKey] ?? 0) + numContainersInShipment;

                // Year
                const yearKey = String(getYear(clearedDate));
                yearlySummary[yearKey] = (yearlySummary[yearKey] ?? 0) + numContainersInShipment;

                if (!bySource.yearly[source]) bySource.yearly[source] = {};
                bySource.yearly[source][yearKey] = (bySource.yearly[source][yearKey] ?? 0) + numContainersInShipment;
            }
        });

        const sortMonths = (keys: string[]) => keys.sort((a, b) => compareAsc(parse(a, 'MMM yy', new Date()), parse(b, 'MMM yy', new Date())));
        const sortWeeks = (keys: string[]) => keys.sort((a, b) => {
             const [wa, ya] = a.replace('W', '').split(' ');
             const [wb, yb] = b.replace('W', '').split(' ');
             if (ya !== yb) return Number(ya) - Number(yb);
             return Number(wa) - Number(wb);
        });
        const sortYears = (keys: string[]) => keys.sort();

        const monthlyData = sortMonths(Object.keys(monthlySummary)).map(m => ({ month: m, containers: monthlySummary[m] }));
        const weeklyData = sortWeeks(Object.keys(weeklySummary)).map(w => ({ week: w, containers: weeklySummary[w] }));
        const yearlyData = sortYears(Object.keys(yearlySummary)).map(y => ({ year: y, containers: yearlySummary[y] }));

        const bySourceMonthly: any = {};
        Object.entries(bySource.monthly).forEach(([src, map]) => {
            bySourceMonthly[src] = sortMonths(Object.keys(map)).map(m => ({ month: m, containers: map[m] }));
        });

        const bySourceWeekly: any = {};
        Object.entries(bySource.weekly).forEach(([src, map]) => {
            bySourceWeekly[src] = sortWeeks(Object.keys(map)).map(w => ({ week: w, containers: map[w] }));
        });

        const bySourceYearly: any = {};
        Object.entries(bySource.yearly).forEach(([src, map]) => {
            bySourceYearly[src] = sortYears(Object.keys(map)).map(y => ({ year: y, containers: map[y] }));
        });

        return {
            totalContainers,
            monthlyData,
            weeklyData,
            yearlyData,
            sourceData: sourceSummary,
            bySource: {
                monthly: bySourceMonthly,
                weekly: bySourceWeekly,
                yearly: bySourceYearly
            },
            monthlyBySource: bySourceMonthly
        };
    } catch (e) {
        return { totalContainers: 0, monthlyData: [], weeklyData: [], yearlyData: [], sourceData: {}, bySource: { monthly: {}, weekly: {}, yearly: {} } };
    }
}

export async function getPendingArrivedTotalLines(): Promise<number> {
    const targetStatuses = ['WIP', 'Arrived'];
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const snap = await adb
            .collection('shipments')
            .where('status', 'in', targetStatuses)
            .get();
        let total = 0;
        snap.docs.forEach((d: any) => {
            const data = d.data ? d.data() : d;
            total += Number(data?.totalLines || 0);
        });
        return total;
    }
    try {
        await ensureClientAuth();
        const shipmentsCol = collection(db, 'shipments');
        const qy = query(shipmentsCol, where('status', 'in', targetStatuses));
        const shipmentSnapshot = await getDocs(qy);
        let total = 0;
        shipmentSnapshot.docs.forEach(doc => {
            const data: any = doc.data();
            total += Number(data?.totalLines || 0);
        });
        return total;
    } catch {
        return 0;
    }
}


export async function isInvoiceUnique(invoice: string, currentId?: string): Promise<boolean> {
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const q = await adb.collection('shipments').where('invoice', '==', invoice.toUpperCase()).get();
        if (q.empty) return true;
        if (currentId) return q.docs.every((d: any) => d.id === currentId);
        return false;
    }
    const shipmentsCol = collection(db, 'shipments');
    const q = query(shipmentsCol, where('invoice', '==', invoice.toUpperCase()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return true;
    if (currentId) return snapshot.docs.every(doc => doc.id === currentId);
    return false;
}



// ...

export async function deleteShipment(id: string) {
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        await adb.collection('shipments').doc(id).delete();
        return;
    }
    await deleteDoc(doc(db, 'shipments', id));
}

// Add test connection function for connection monitoring
export async function testConnection(): Promise<boolean> {
  try {
    // Simple operation to test Firestore connectivity
    const testQuery = query(collection(db, 'Users'), limit(1));
    await getDocs(testQuery);
    return true;
  } catch (error) {
    console.warn('Firestore connection test failed:', error);
    return false;
  }
}

// Enhanced error handling wrapper for Firestore operations
function withRetry<T>(operation: () => Promise<T>, maxRetries: number = 2): Promise<T> {
  return new Promise(async (resolve, reject) => {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        resolve(result);
        return;
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a retryable error
        const isRetryable = error.code === 'unavailable' || 
                           error.code === 'deadline-exceeded' ||
                           error.message?.includes('Could not reach Cloud Firestore backend') ||
                           error.message?.includes('Name resolution failed');
        
        if (!isRetryable || attempt === maxRetries) {
          reject(lastError);
          return;
        }
        
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    reject(lastError);
  });
}
