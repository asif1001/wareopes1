import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shipmentId = searchParams.get('shipmentId');
    if (!shipmentId) {
      return NextResponse.json({ error: 'Missing shipmentId' }, { status: 400 });
    }

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    // Scan ProductionCases for balances and filter out fully consumed
    const casesCol = adb.collection('shipments').doc(String(shipmentId)).collection('ProductionCases');
    const snap = await casesCol.get();
    const balances: { caseNumber: string; remainingLines: number }[] = [];
    for (const d of snap.docs) {
      const data: any = d.data() || {};
      const total = Number(data?.totalLines || 0);
      const consumed = Number(data?.consumedLines || 0);
      const remaining = Math.max(0, total - consumed);
      if (remaining > 0) {
        balances.push({ caseNumber: String(d.id), remainingLines: remaining });
      }
    }
    const caseNumbers: string[] = balances.map(b => b.caseNumber);

    return NextResponse.json({ caseNumbers, balances });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}