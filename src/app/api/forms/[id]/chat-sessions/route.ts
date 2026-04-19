import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/forms/:id/chat-sessions — 해당 폼의 채팅 세션 목록 조회
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const { id: formId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 폼 소유권 확인
  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { ownerId: true },
  });

  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  if (form.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const chatSessions = await prisma.chatSession.findMany({
    where: { formId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(chatSessions);
}

/**
 * POST /api/forms/:id/chat-sessions — 새로운 채팅 세션 생성
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const { id: formId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 폼 소유권 확인
  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { ownerId: true },
  });

  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  if (form.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { title } = await request.json();
    
    const chatSession = await prisma.chatSession.create({
      data: {
        formId,
        title: title || 'New Chat',
      },
    });

    return NextResponse.json(chatSession);
  } catch (error) {
    console.error('[API] Failed to create chat session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
