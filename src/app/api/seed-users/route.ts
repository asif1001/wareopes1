import { NextResponse } from 'next/server';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';

export async function POST() {
	try {
		const usersCol = collection(db, 'Users');
		const snapshot = await getDocs(usersCol);

		if (!snapshot.empty) {
			return NextResponse.json({ ok: true, message: 'Users already exist. No action taken.' });
		}

		const now = new Date();
		const adminUser = {
			employeeNo: '12345',
			fullName: 'Test Admin',
			email: 'admin@wareops.local',
			department: 'IT',
			role: 'Admin',
			password: 'password123',
			phone: '+1234567890',
			profilePicture: null,
			createdAt: now,
			updatedAt: now,
		};

		const regularUser = {
			employeeNo: '54321',
			fullName: 'Regular User',
			email: 'user@wareops.local',
			department: 'Warehouse',
			role: 'Employee',
			password: 'password123',
			phone: '+1234567891',
			profilePicture: null,
			createdAt: now,
			updatedAt: now,
		};

		const adminRef = await addDoc(usersCol, adminUser);
		const userRef = await addDoc(usersCol, regularUser);

		return NextResponse.json({ ok: true, created: [adminRef.id, userRef.id] });
	} catch (e: any) {
		console.error('Seed users error:', e);
		return NextResponse.json({ ok: false, error: e?.message || 'Unknown error' }, { status: 500 });
	}
}

export async function GET() {
	return NextResponse.json({ ok: true, usage: 'POST to seed default users if none exist.' });
}

