import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt, maskKey } from '@/lib/utils/encryption';

const DB_SECRET_KEY = process.env.DB_SECRET_KEY || process.env.SESSION_SECRET_KEY || 'default-db-secret-change-me-in-prod';

/**
 * GET /api/secrets
 * List user-provided secrets (masked) for Mode B
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const secrets = await prisma.userSecret.findMany({
      where: { userId: session.user.id },
      select: { provider: true, createdAt: true, updatedAt: true }
    });

    // In a real scenario, we might return masked keys here if we stored them separately or decrypt them
    // For now, we just indicate which providers have keys active.
    return NextResponse.json(secrets);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch secrets' }, { status: 500 });
  }
}

/**
 * POST /api/secrets
 * Store a secret key in the database (Mode B)
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { provider, apiKey, category = 'ai_secret' } = await request.json();

    if (!provider || !apiKey) {
      return NextResponse.json({ error: 'Missing provider or apiKey' }, { status: 400 });
    }

    // Encrypt the API key before storing in the DB
    const { encryptedData, iv, salt } = encrypt(apiKey, DB_SECRET_KEY);

    const secret = await prisma.userSecret.upsert({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider
        }
      },
      update: {
        encryptedKey: encryptedData,
        iv,
        salt,
        category
      },
      create: {
        userId: session.user.id,
        provider,
        category,
        encryptedKey: encryptedData,
        iv,
        salt
      }
    });

    return NextResponse.json({ 
      success: true, 
      provider: secret.provider,
      maskedKey: maskKey(apiKey)
    });
  } catch (error: any) {
    console.error('[DB Secret] Error:', error);
    return NextResponse.json({ error: 'Failed to store secret' }, { status: 500 });
  }
}

/**
 * DELETE /api/secrets
 * Delete a secret key from the database
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { provider } = await request.json();
    if (!provider) {
      return NextResponse.json({ error: 'Missing provider' }, { status: 400 });
    }

    await prisma.userSecret.delete({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to delete secret' }, { status: 500 });
  }
}
