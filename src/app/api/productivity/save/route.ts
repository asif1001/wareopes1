import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, userId, sortingEntries = [], packingEntries = [] } = body || {};

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    const d = date && typeof date === 'string' ? new Date(date) : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateId = `${yyyy}-${mm}-${dd}`;

    const { getAdminDb, getAdmin } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    const admin = await getAdmin();

    const basePath = adb.collection('productivityUsers').doc(userId).collection('daily').doc(dateId);

    const batch = adb.batch();
    const entriesCol = basePath.collection('entries');

    // Validate and update case allocations via transactions before writing entries
    for (const e of Array.isArray(sortingEntries) ? sortingEntries : []) {
      const shipmentId = String(e.shipmentId || '');
      const caseNumber = String(e.caseNumber || '');
      const reqLines = Number(e.totalLines || 0);
      if (!shipmentId || !caseNumber || !Number.isFinite(reqLines) || reqLines <= 0) {
        return NextResponse.json({ error: 'INVALID_SORTING_ENTRY' }, { status: 400 });
      }
      const caseRef = adb.collection('shipments').doc(shipmentId).collection('ProductionCases').doc(caseNumber);
      await adb.runTransaction(async (tx) => {
        const snap = await tx.get(caseRef);
        if (!snap.exists) {
          throw new Error('CASE_NOT_FOUND');
        }
        const data: any = snap.data() || {};
        const total = Number(data?.totalLines || 0);
        const consumed = Number(data?.consumedLines || 0);
        const remaining = Math.max(0, total - consumed);
        if (reqLines > remaining) {
          throw new Error(`EXCEEDS_REMAINING:${remaining}`);
        }
        const newConsumed = consumed + reqLines;
        tx.update(caseRef, {
          consumedLines: newConsumed,
          remainingLines: Math.max(0, total - newConsumed),
          fullySorted: newConsumed >= total,
          lastAllocatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastAllocatedBy: userId,
        });
      });
    }

    // Write sorting entries
    for (const e of Array.isArray(sortingEntries) ? sortingEntries : []) {
      const docRef = entriesCol.doc();
      const docData: any = {
        type: 'sorting',
        shipmentId: String(e.shipmentId || ''),
        caseNumber: String(e.caseNumber || ''),
        totalLines: Number(e.totalLines || 0),
        ekcDomestic: Number(e.ekcDomestic || 0),
        ekmBulk: Number(e.ekmBulk || 0),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        date: d,
      };
      batch.set(docRef, docData);
    }

    // Write packing entries
    for (const e of Array.isArray(packingEntries) ? packingEntries : []) {
      const docRef = entriesCol.doc();
      const docData: any = {
        type: 'packing',
        locationNo: String(e.locationNo || ''),
        newCaseNo: String(e.newCaseNo || ''),
        linesPacked: Number(e.linesPacked || 0),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        date: d,
      };
      batch.set(docRef, docData);
    }

    // Compute daily summary
    const sortingTotalCases = (Array.isArray(sortingEntries) ? sortingEntries.length : 0);
    const sortingTotalLines = (Array.isArray(sortingEntries) ? sortingEntries.reduce((sum: number, e: any) => sum + Number(e.totalLines || 0), 0) : 0);
    const sortingTotalEKC = (Array.isArray(sortingEntries) ? sortingEntries.reduce((sum: number, e: any) => sum + Number(e.ekcDomestic || 0), 0) : 0);
    const sortingTotalEKM = (Array.isArray(sortingEntries) ? sortingEntries.reduce((sum: number, e: any) => sum + Number(e.ekmBulk || 0), 0) : 0);

    const packingTotalCases = (Array.isArray(packingEntries) ? packingEntries.length : 0);
    const packingTotalLines = (Array.isArray(packingEntries) ? packingEntries.reduce((sum: number, e: any) => sum + Number(e.linesPacked || 0), 0) : 0);

    const summaryDoc = basePath.collection('summary').doc('day');
    batch.set(summaryDoc, {
      date: d,
      sorting: {
        totalCases: sortingTotalCases,
        totalLines: sortingTotalLines,
        totalEKC: sortingTotalEKC,
        totalEKM: sortingTotalEKM,
      },
      packing: {
        totalCases: packingTotalCases,
        totalLines: packingTotalLines,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Ensure the parent daily doc has the date for monthly range queries
    batch.set(basePath, {
      date: d,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await batch.commit();

    return NextResponse.json({
      ok: true,
      summary: {
        date: dateId,
        sorting: {
          totalCases: sortingTotalCases,
          totalLines: sortingTotalLines,
          totalEKC: sortingTotalEKC,
          totalEKM: sortingTotalEKM,
        },
        packing: {
          totalCases: packingTotalCases,
          totalLines: packingTotalLines,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}