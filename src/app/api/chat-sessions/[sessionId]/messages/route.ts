import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/chat-sessions/:sessionId/messages — 세션에 새로운 메시지 추가
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const { sessionId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 세션 존재 및 권한 확인
  const chatSession = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      form: { select: { ownerId: true } },
      _count: { select: { messages: true } }
    },
  });

  if (!chatSession) {
    return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
  }

  if (chatSession.form.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { role, content } = await request.json();

    const message = await prisma.chatMessage.create({
      data: {
        sessionId,
        role,
        content,
      },
    });

    // 만약 첫 번째 사용자 메시지라면 세션 제목을 업데이트
    if (chatSession._count.messages === 0 && role === 'user') {
      const title = content.length > 30 ? content.substring(0, 27) + '...' : content;
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { title },
      });
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('[API] Failed to add message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
