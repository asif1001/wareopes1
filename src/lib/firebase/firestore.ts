import { db } from './firebase';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, query, where, serverTimestamp, orderBy, limit, writeBatch } from 'firebase/firestore';
import type { Shipment, User, Source, ContainerSize, Department, Branch, ContainerBooking, Container, ClearedContainerSummary } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import type { SerializableShipment } from '@/lib/types';
import { format, subMonths, startOfMonth, parse, compareAsc, subDays } from 'date-fns';

function docToShipment(doc: any): SerializableShipment {
    const data = doc.data();
    // Function to convert Firestore Timestamps to ISO strings for serialization
    const toISOString = (timestamp: any): string | undefined => {
      if (timestamp instanceof Timestamp) {
        return timestamp.toDate().toISOString();
      }
      return undefined;
    };
  
    const bookings = data.bookings?.map((b: any) => ({
        ...b,
        bookingDate: toISOString(b.bookingDate)
    })) || [];

    return {
      id: doc.id,
      source: data.source,
      invoice: data.invoice,
      billOfLading: data.billOfLading,
      numContainers: data.numContainers,
      containers: data.containers,
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
    };
}

export async function getShipments(): Promise<SerializableShipment[]> {
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


export async function getUpcomingShipments(): Promise<SerializableShipment[]> {
    const shipmentsCol = collection(db, 'shipments');
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    const fifteenDaysAgo = subDays(new Date(), 15);
    fifteenDaysAgo.setHours(0, 0, 0, 0); // Start of the 15th day ago

    const q = query(
        shipmentsCol,
        where("actualClearedDate", ">=", fifteenDaysAgo),
        where("actualClearedDate", "<=", today),
        orderBy("actualClearedDate", "desc")
    );

    const shipmentSnapshot = await getDocs(q);
    return shipmentSnapshot.docs.map(docToShipment);
}

export async function getClearedShipmentsMonthlySummary(): Promise<{ month: string; domLines: number; bulkLines: number }[]> {
    const shipmentsCol = collection(db, 'shipments');
    const q = query(shipmentsCol, where("cleared", "==", true));
    
    const shipmentSnapshot = await getDocs(q);
    
    const monthlySummary: { [key: string]: { domLines: number; bulkLines: number } } = {};

    shipmentSnapshot.docs.forEach(doc => {
        const data = doc.data();
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

    const result = sortedMonths.map(month => ({
        month,
        domLines: monthlySummary[month].domLines,
        bulkLines: monthlySummary[month].bulkLines,
    }));

    return result;
}

export async function getClearedContainerSummary(): Promise<ClearedContainerSummary> {
    const shipmentsCol = collection(db, 'shipments');
    const q = query(shipmentsCol, where("cleared", "==", true));
    const shipmentSnapshot = await getDocs(q);

    const monthlySummary: { [key: string]: number } = {};
    const sourceSummary: { [key: string]: number } = {};
    let totalContainers = 0;

    shipmentSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const clearedDate = data.actualClearedDate?.toDate();
        
        // Use bookings array as the source of truth for cleared container counts
        if (clearedDate && data.bookings && data.bookings.length > 0) {
            const monthYear = format(clearedDate, "MMM yy");
            
            const numContainersInShipment = data.bookings.length;
            
            // Monthly aggregation
            if (!monthlySummary[monthYear]) {
                monthlySummary[monthYear] = 0;
            }
            monthlySummary[monthYear] += numContainersInShipment;

            // Source aggregation
            const source = data.source || 'Unknown';
            if (!sourceSummary[source]) {
                sourceSummary[source] = 0;
            }
            sourceSummary[source] += numContainersInShipment;

            // Total aggregation
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
    const shipmentsCol = collection(db, 'shipments');
    const q = query(shipmentsCol, where('invoice', '==', invoice.toUpperCase()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return true;
    }
    // If we're editing, we need to make sure the found invoice is not the one we're currently editing
    if (currentId) {
        return snapshot.docs.every(doc => doc.id === currentId);
    }
    return false;
}

export async function addShipment(shipment: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt' | 'bookings'>) {
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
    await addDoc(collection(db, 'shipments'), shipmentData);
}

export async function bulkAddShipments(shipments: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt' | 'bookings'>[]) {
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
    const shipmentData: any = {
        ...shipment,
        ...(shipment.invoice && { invoice: shipment.invoice.toUpperCase() }),
        ...(shipment.billOfLading && { billOfLading: shipment.billOfLading.toUpperCase() }),
        ...(shipment.source && { source: shipment.source.toUpperCase() }),
        updatedAt: serverTimestamp(),
    };

    if (shipment.cleared && shipment.actualClearedDate) {
        shipmentData.monthYear = format(shipment.actualClearedDate, 'MMM yy');
    } else if (shipment.cleared === false) {
        shipmentData.monthYear = null;
    }

    await updateDoc(doc(db, 'shipments', id), shipmentData);
}

export async function updateShipmentBookings(id: string, bookings: ContainerBooking[]) {
    const clearedDate = new Date();
    await updateDoc(doc(db, 'shipments', id), {
        bookings,
        cleared: true,
        actualClearedDate: clearedDate,
        actualBahrainEta: clearedDate,
        monthYear: format(clearedDate, 'MMM yy'),
        updatedAt: serverTimestamp(),
    });
}

export async function deleteShipment(id: string) {
    await deleteDoc(doc(db, 'shipments', id));
}


// User Functions
export async function getUsers(): Promise<User[]> {
    const usersCol = collection(db, 'Users');
    const userSnapshot = await getDocs(usersCol);
    return userSnapshot.docs.map(doc => {
        const data = doc.data();
        // Function to convert Firestore Timestamps to ISO strings for serialization
        const toISOString = (timestamp: any): string | undefined => {
            if (timestamp instanceof Timestamp) {
                return timestamp.toDate().toISOString();
            }
            return undefined;
        };
        
        return {
            id: doc.id,
            ...data,
            createdAt: toISOString(data.createdAt),
            updatedAt: toISOString(data.updatedAt)
        } as User;
    });
}

export async function getUserByEmployeeNo(employeeNo: string): Promise<User | null> {
    const usersCol = collection(db, 'Users');
    const q = query(usersCol, where('employeeNo', '==', employeeNo));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    const userDoc = snapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() } as User;
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
