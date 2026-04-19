import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/chat-sessions/:sessionId — 세션 상세 정보 및 메시지 목록 조회
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const { sessionId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const chatSession = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      form: {
        select: { ownerId: true },
      },
    },
  });

  if (!chatSession) {
    return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
  }

  if (chatSession.form.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // form 필드는 ownerId 확인용이었으므로 응답에서는 제외하거나 정리 가능
  const { form, ...data } = chatSession;

  return NextResponse.json(data);
}

/**
 * DELETE /api/chat-sessions/:sessionId — 채팅 세션 삭제
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const { sessionId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const chatSession = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      form: {
        select: { ownerId: true },
      },
    },
  });

  if (!chatSession) {
    return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
  }

  if (chatSession.form.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.chatSession.delete({
    where: { id: sessionId },
  });

  return NextResponse.json({ success: true });
}
