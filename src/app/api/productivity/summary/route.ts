import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month'); // YYYY-MM
    if (!userId || !month) {
      return NextResponse.json({ error: 'Missing userId or month (YYYY-MM)' }, { status: 400 });
    }
    const [yyyyStr, mmStr] = month.split('-');
    const yyyy = Number(yyyyStr);
    const mm = Number(mmStr);
    if (!yyyy || !mm) {
      return NextResponse.json({ error: 'Invalid month format' }, { status: 400 });
    }

    // Compute start and end of month
    const start = new Date(yyyy, mm - 1, 1);
    const end = new Date(yyyy, mm, 0); // last day of month
    end.setHours(23, 59, 59, 999);

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();

    const dailyCol = adb.collection('productivityUsers').doc(userId).collection('daily');
    // Primary: use range query on parent doc date
    let snap = await dailyCol
      .where('date', '>=', start)
      .where('date', '<=', end)
      .get();
    // Fallback: if no docs found (older saves didn't set parent date), scan all and filter using summary/day
    if (snap.empty) {
      snap = await dailyCol.get();
    }

    const chartData: any[] = [];
    let sorterLinesTotal = 0;
    let packerLinesTotal = 0;
    let sorterCasesTotal = 0;
    let packerCasesTotal = 0;

    for (const doc of snap.docs) {
      let jsDate: Date;
      const dateVal: any = doc.get('date');
      if (dateVal) {
        jsDate = dateVal instanceof Date ? dateVal : dateVal?.toDate?.() || new Date();
      } else {
        // Try reading summary/day date, otherwise derive from doc id (YYYY-MM-DD)
        const sumSnap = await doc.ref.collection('summary').doc('day').get();
        const sdata = sumSnap.exists ? sumSnap.data() as any : null;
        const sdate: any = sdata?.date;
        if (sdate) {
          jsDate = sdate instanceof Date ? sdate : sdate?.toDate?.() || new Date();
        } else {
          const id = String(doc.id || '');
          const parts = id.split('-');
          if (parts.length === 3) {
            const y = Number(parts[0]);
            const m = Number(parts[1]);
            const d = Number(parts[2]);
            jsDate = new Date(y, (m || 1) - 1, d || 1);
          } else {
            jsDate = new Date();
          }
        }
      }
      const label = `${jsDate.getFullYear()}-${String(jsDate.getMonth() + 1).padStart(2, '0')}-${String(jsDate.getDate()).padStart(2, '0')}`;

      // Filter outside month in fallback mode
      if (jsDate < start || jsDate > end) {
        // Skip when we scanned all without a range query
        if (snap.empty) continue;
      }

      // read day summary subdoc
      const sumSnap = await doc.ref.collection('summary').doc('day').get();
      const sdata = sumSnap.exists ? sumSnap.data() as any : null;
      const sorterLines = sdata?.sorting?.totalLines || 0;
      const packerLines = sdata?.packing?.totalLines || 0;
      const sorterCases = sdata?.sorting?.totalCases || 0;
      const packerCases = sdata?.packing?.totalCases || 0;

      sorterLinesTotal += sorterLines;
      packerLinesTotal += packerLines;
      sorterCasesTotal += sorterCases;
      packerCasesTotal += packerCases;

      chartData.push({ label, sorterLines, packerLines });
    }

    // sort chart data by date ascending
    chartData.sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({
      chartData,
      totals: {
        sorterLines: sorterLinesTotal,
        packerLines: packerLinesTotal,
        sorterCases: sorterCasesTotal,
        packerCases: packerCasesTotal,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}