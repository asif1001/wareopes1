import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
    try {
        // Invalidate the session by deleting the cookie
        (await cookies()).delete('session');

        return NextResponse.json({ success: true, message: 'Logged out successfully.' });

    } catch (error) {
        console.error('Logout API error:', error);
        return NextResponse.json({ success: false, error: 'An unexpected error occurred.' }, { status: 500 });
    }
}
