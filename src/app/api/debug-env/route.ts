import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const cwd = process.cwd();
    const envCreds = process.env.FIREBASE_ADMIN_CREDENTIALS;
    const envCredsLen = envCreds ? envCreds.length : 0;
    const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS || null;
    const saPathCwd = path.resolve(cwd, 'serviceAccount.json');
    const saExistsCwd = fs.existsSync(saPathCwd);

    return NextResponse.json({
      ok: true,
      cwd,
      __dirname: __dirname,
      env: {
        FIREBASE_ADMIN_CREDENTIALS: !!envCreds,
        FIREBASE_ADMIN_CREDENTIALS_len: envCredsLen,
        GOOGLE_APPLICATION_CREDENTIALS: gac,
      },
      serviceAccount: {
        pathFromCwd: saPathCwd,
        existsAtCwd: saExistsCwd,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}