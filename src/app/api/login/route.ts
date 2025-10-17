/**
 * Server Login Route (/api/login)
 *
 * What this does
 * - Verifies the user by employeeNo/password against the Firestore Users collection using the Firebase Admin SDK.
 * - Sets a secure HTTP-only 'session' cookie with the user id so Next.js middleware can protect /dashboard routes.
 *
 * Why we use Admin here
 * - Admin SDK bypasses Firestore security rules, so login never fails due to client auth state.
 * - This keeps credential verification server-side and avoids exposing passwords in client code.
 *
 * Security notes
 * - This implementation compares a plaintext password from Firestore. For production, store hashed passwords and verify using a password hashing library (e.g., bcrypt).
 */
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
// Dynamically import admin helper at runtime to avoid bundling firebase-admin into client codepaths

export async function POST(req: NextRequest) {
    try {
        const { employeeNo, password } = await req.json();
        if (!employeeNo || !password) {
            return NextResponse.json({ error: 'Employee number and password are required.' }, { status: 400 });
        }

        // Verify via Firebase Admin (bypasses security rules)
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adminDb = await getAdminDb();

        const tryQuery = async (col: string, val: string | number) =>
            adminDb.collection(col).where('employeeNo', '==', val).limit(1).get();

        let snap = await tryQuery('Users', employeeNo);
        if (snap.empty) {
            const maybeNum = Number(employeeNo);
            if (!Number.isNaN(maybeNum)) {
                snap = await tryQuery('Users', maybeNum);
            }
        }
        if (snap.empty) {
            try {
                snap = await tryQuery('users', employeeNo);
                if (snap.empty) {
                    const maybeNum = Number(employeeNo);
                    if (!Number.isNaN(maybeNum)) {
                        snap = await tryQuery('users', maybeNum);
                    }
                }
            } catch (_) {
                // ignore collection access errors and continue to invalid response
            }
        }

        if (snap.empty) {
            return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
        }
        const doc = snap.docs[0];
        const data = doc.data() as any;

        if (!data || data.password !== password) {
            return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
        }

        const user = {
            id: doc.id,
            employeeNo: data.employeeNo,
            fullName: data.fullName,
            role: data.role,
            department: data.department,
            email: data.email ?? null,
            profilePicture: data.profilePicture ?? null,
        };

        (await cookies()).set('session', String(user.id), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
            maxAge: 60 * 60 * 8, // 8 hours
        });

        return NextResponse.json({ success: true, user });
    } catch (error) {
        console.error('Login API error:', error);
        return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
}
