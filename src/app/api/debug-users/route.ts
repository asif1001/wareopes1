
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

export async function GET() {
    try {
        const adb = await getAdminDb();
        const snapshot = await adb.collection('Users').get();
        const users = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                employeeNo: data.employeeNo,
                password: data.password, // exposing for debug only
                role: data.role
            };
        });
        return NextResponse.json({ users });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
