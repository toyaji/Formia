import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/utils/encryption';
import { cookies } from 'next/headers';

const SESSION_SECRET_KEY = process.env.SESSION_SECRET_KEY || 'default-session-secret-change-me-in-prod';

/**
 * POST /api/secrets/session
 * Store a secret key in an encrypted session cookie (Mode A)
 */
export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey } = await request.json();

    if (!provider || !apiKey) {
      return NextResponse.json({ error: 'Missing provider or apiKey' }, { status: 400 });
    }

    // Encrypt the API key before storing in the session cookie
    // We use a server-side secret for this transient storage
    const { encryptedData, iv, salt } = encrypt(apiKey, SESSION_SECRET_KEY);

    // Store in HttpOnly cookie
    // Next.js 13+ App Router cookie handling
    const cookieStore = cookies();
    cookieStore.set(`secret_${provider}`, JSON.stringify({ encryptedData, iv, salt }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return NextResponse.json({ success: true, provider });
  } catch (error: any) {
    console.error('[Session Secret] Error:', error);
    return NextResponse.json({ error: 'Failed to store session secret' }, { status: 500 });
  }
}

/**
 * DELETE /api/secrets/session
 * Clear a secret key from the session
 */
export async function DELETE(request: NextRequest) {
  try {
    const { provider } = await request.json();
    if (!provider) {
      return NextResponse.json({ error: 'Missing provider' }, { status: 400 });
    }

    const cookieStore = cookies();
    cookieStore.delete(`secret_${provider}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to delete session secret' }, { status: 500 });
  }
}
