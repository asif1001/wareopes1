import { db } from './firebase';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, query, where, serverTimestamp, orderBy, limit, writeBatch } from 'firebase/firestore';
import type { Shipment, User, Source, ContainerSize, Department, Branch, ContainerBooking, Container, ClearedContainerSummary, Role } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import type { SerializableShipment } from '@/lib/types';
import { format, subMonths, startOfMonth, parse, compareAsc, subDays } from 'date-fns';

function docToShipment(doc: any): SerializableShipment {
        const data = typeof doc.data === 'function' ? doc.data() : doc; // support admin and client snapshots
        // Function to convert Firestore/Admin Timestamps to ISO strings for serialization
        const toISOString = (timestamp: any): string | undefined => {
            if (timestamp && typeof timestamp.toDate === 'function') {
                try { return timestamp.toDate().toISOString(); } catch { return undefined; }
            }
            if (timestamp instanceof Date) {
                return timestamp.toISOString();
            }
            return undefined;
        };
  
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
          return { id: d.id, ...raw, ...(permissions ? { permissions } : {}) } as User;
        });
    }
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
      return { id: doc.id, ...raw, ...(permissions ? { permissions } : {}) } as User;
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
        return snap.docs.map((d: any) => ({ id: d.id, ...(d.data ? d.data() : d) } as ContainerSize));
    }
    const sizesCol = collection(db, 'ContainerSizes');
    const sizeSnapshot = await getDocs(sizesCol);
    return sizeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContainerSize));
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
        const snap = await adb.collection('Branches').get();
        return snap.docs.map((d: any) => ({ id: d.id, ...(d.data ? d.data() : d) } as Branch));
    }
    const branchesCol = collection(db, 'Branches');
    const branchSnapshot = await getDocs(branchesCol);
    return branchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
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
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const fifteenDaysAgo = subDays(new Date(), 15);
    fifteenDaysAgo.setHours(0, 0, 0, 0);

    // Use Admin SDK on the server to bypass rules
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
}

export async function getClearedShipmentsMonthlySummary(): Promise<{ month: string; domLines: number; bulkLines: number }[]> {
    const twelveMonthsAgo = subMonths(new Date(), 12);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let docs: any[] = [];
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const snap = await adb
            .collection('shipments')
            .where('actualClearedDate', '>=', twelveMonthsAgo)
            .where('actualClearedDate', '<=', today)
            .get();
        docs = snap.docs;
    } else {
        const shipmentsCol = collection(db, 'shipments');
        const qy = query(
            shipmentsCol,
            where('actualClearedDate', '>=', twelveMonthsAgo),
            where('actualClearedDate', '<=', today)
        );
        const shipmentSnapshot = await getDocs(qy);
        docs = shipmentSnapshot.docs;
    }

    const monthlySummary: { [key: string]: { domLines: number; bulkLines: number } } = {};

    docs.forEach((doc: any) => {
        const data = typeof doc.data === 'function' ? doc.data() : doc;
        const clearedDate = data.actualClearedDate?.toDate();

        if (clearedDate) {
            const monthYear = format(clearedDate, "MMM yy");

            if (!monthlySummary[monthYear]) {
                monthlySummary[monthYear] = { domLines: 0, bulkLines: 0 };
            }
            monthlySummary[monthYear].domLines += data.domLines || 0;
            monthlySummary[monthYear].bulkLines += data.bulkLines || 0;
        }
    });

    const sortedMonths = Object.keys(monthlySummary).sort((a, b) => {
        const dateA = parse(a, 'MMM yy', new Date());
        const dateB = parse(b, 'MMM yy', new Date());
        return compareAsc(dateA, dateB);
    });

    return sortedMonths.map(month => ({
        month,
        domLines: monthlySummary[month].domLines,
        bulkLines: monthlySummary[month].bulkLines,
    }));
}

export async function getClearedContainerSummary(): Promise<ClearedContainerSummary> {
    const twelveMonthsAgo = subMonths(new Date(), 12);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let docs: any[] = [];
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('./admin');
        const adb = await getAdminDb();
        const snap = await adb
            .collection('shipments')
            .where('actualClearedDate', '>=', twelveMonthsAgo)
            .where('actualClearedDate', '<=', today)
            .get();
        docs = snap.docs;
    } else {
        const shipmentsCol = collection(db, 'shipments');
        const qy = query(
            shipmentsCol,
            where('actualClearedDate', '>=', twelveMonthsAgo),
            where('actualClearedDate', '<=', today)
        );
        const shipmentSnapshot = await getDocs(qy);
        docs = shipmentSnapshot.docs;
    }

    const monthlySummary: { [key: string]: number } = {};
    const sourceSummary: { [key: string]: number } = {};
    let totalContainers = 0;

    docs.forEach((doc: any) => {
        const data = typeof doc.data === 'function' ? doc.data() : doc;
        const clearedDate = data.actualClearedDate?.toDate();

        if (clearedDate && data.bookings && data.bookings.length > 0) {
            const monthYear = format(clearedDate, "MMM yy");
            const numContainersInShipment = data.bookings.length;

            if (!monthlySummary[monthYear]) {
                monthlySummary[monthYear] = 0;
            }
            monthlySummary[monthYear] += numContainersInShipment;

            const source = data.source || 'Unknown';
            if (!sourceSummary[source]) {
                sourceSummary[source] = 0;
            }
            sourceSummary[source] += numContainersInShipment;

            totalContainers += numContainersInShipment;
        }
    });

    const sortedMonths = Object.keys(monthlySummary).sort((a, b) => {
        const dateA = parse(a, 'MMM yy', new Date());
        const dateB = parse(b, 'MMM yy', new Date());
        return compareAsc(dateA, dateB);
    });

    const monthlyData = sortedMonths.map(month => ({
        month,
        containers: monthlySummary[month],
    }));

    return {
        totalContainers,
        monthlyData,
        sourceData: sourceSummary
    };
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
