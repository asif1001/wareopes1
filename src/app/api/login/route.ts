export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second
const MAX_DELAY = 5000; // 5 seconds

// Exponential backoff with jitter
function getRetryDelay(attempt: number): number {
  const baseDelay = Math.min(INITIAL_DELAY * Math.pow(2, attempt), MAX_DELAY);
  const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
  return baseDelay + jitter;
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper for database operations
async function withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a retryable error
      const isRetryableError = error.code === 14 || // gRPC UNAVAILABLE
                              error.message?.includes('UNAVAILABLE') || 
                              error.message?.includes('Name resolution failed') ||
                              error.message?.includes('ENOTFOUND') ||
                              error.message?.includes('ECONNREFUSED');
      
      if (!isRetryableError || attempt === MAX_RETRIES - 1) {
        console.error(`${operationName} failed after ${attempt + 1} attempts:`, error.message);
        throw error;
      }
      
      const delay = getRetryDelay(attempt);
      console.warn(`${operationName} failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${Math.round(delay)}ms:`, error.message);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

export async function POST(request: NextRequest) {
    try {
        const { employeeNo, password } = await request.json();

        if (!employeeNo || !password) {
            return NextResponse.json({ error: 'Employee number and password are required' }, { status: 400 });
        }

        // Get admin database with retry logic
        const adminDb = await withRetry(
            () => getAdminDb(),
            'Admin DB initialization'
        );

        // Query with retry logic
        const tryQuery = async (col: string, val: string | number) =>
            withRetry(
                () => adminDb.collection(col).where('employeeNo', '==', val).limit(1).get(),
                `Query ${col} collection for employeeNo ${val}`
            );

        const maybeNum = Number(employeeNo);
        const candidates: Array<{ col: string; val: string | number }> = [
            { col: 'Users', val: employeeNo },
            ...(Number.isNaN(maybeNum) ? [] : [{ col: 'Users', val: maybeNum }]),
            { col: 'users', val: employeeNo },
            ...(Number.isNaN(maybeNum) ? [] : [{ col: 'users', val: maybeNum }]),
        ];

        let userDoc: any = null;
        
        for (const c of candidates) {
            try {
                const snap = await tryQuery(c.col, c.val);
                if (!snap.empty) {
                    userDoc = snap.docs[0];
                    break;
                }
            } catch (error) {
                console.warn(`Failed to query ${c.col} with value ${c.val}:`, error);
                // Continue to next candidate
            }
        }

        if (!userDoc) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const userData = userDoc.data();
        
        // Verify password (plaintext comparison; migrate to hashed passwords in production)
        const isValidPassword = userData?.password === password;
        if (!isValidPassword) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Create session cookie
        const sessionData = {
            id: userDoc.id,
            employeeNo: userData.employeeNo,
            name: userData.name || userData.fullName,
            email: userData.email,
            role: userData.role,
            department: userData.department,
            branch: userData.branch,
            redirectPage: userData.redirectPage, // propagate user redirect preference
        };

        const response = NextResponse.json(sessionData);
        
        // Set session cookie
        response.cookies.set('session', JSON.stringify(sessionData), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return response;

    } catch (error: any) {
        console.error('Login API error:', error);
        
        // Provide specific error messages for connection issues
        if (error.code === 14 || error.message?.includes('Name resolution failed')) {
            return NextResponse.json({ 
                error: 'Connection issue detected. Please check your internet connection and try again.' 
            }, { status: 503 });
        }
        
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
