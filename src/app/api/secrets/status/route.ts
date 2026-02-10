import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { maskKey } from '@/lib/utils/encryption';

/**
 * GET /api/secrets/status
 * Check which provider keys are currently active (Session or DB)
 */
export async function GET(request: NextRequest) {
  const providers = ['gemini', 'openai', 'anthropic'];
  const status: Record<string, { active: boolean; masked: string }> = {};

  const session = await auth();
  const userId = session?.user?.id;
  const cookieStore = cookies();

  for (const provider of providers) {
    let isActive = false;
    let masked = '';

    // Check Session (Mode A)
    const sessionCookie = cookieStore.get(`secret_${provider}`);
    if (sessionCookie) {
      isActive = true;
      masked = 'Session Key'; // We don't have the raw key to mask properly without decrypting, 
                              // but we can just say it's active.
    }

    // Check DB (Mode B) - Prioritize DB if logged in
    if (userId) {
      const dbSecret = await prisma.userSecret.findUnique({
        where: { userId_provider: { userId, provider } },
        select: { provider: true }
      });
      if (dbSecret) {
        isActive = true;
        masked = 'Cloud Key';
      }
    }

    status[provider] = { active: isActive, masked };
  }

  return NextResponse.json(status);
}
