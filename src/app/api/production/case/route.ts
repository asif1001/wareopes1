import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function sanitize(s: any) {
  return String(s ?? '').trim().replace(/[^-A-Za-z0-9_/\\]/g, '');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shipmentId = sanitize(searchParams.get('shipmentId'));
    const caseNumber = sanitize(searchParams.get('caseNumber'));
    if (!shipmentId || !caseNumber) {
      return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 });
    }

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    const doc = await adb.collection('shipments').doc(shipmentId).collection('ProductionCases').doc(caseNumber).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    const data = doc.data();
    const total = Number((data as any)?.totalLines || 0);
    const consumed = Number((data as any)?.consumedLines || 0);
    const remainingLines = Math.max(0, total - consumed);
    return NextResponse.json({ success: true, shipmentId, caseNumber, data: { ...data, remainingLines, consumedLines: consumed } });
  } catch (e: any) {
    return NextResponse.json({ error: 'SERVER_ERROR', message: e?.message || 'Unknown error' }, { status: 500 });
  }
}