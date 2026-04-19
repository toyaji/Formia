import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/forms/[id]/publish
 * 설문을 배포 상태로 전환하고 고유한 shortId를 생성합니다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    // 1. 해당 설문이 존재하고 소유자가 맞는지 확인
    const form = await prisma.form.findUnique({
      where: { id, ownerId: session.user.id },
      include: { deployment: true }
    });

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // 2. shortId 생성 (이미 있으면 유지, 없으면 새로 생성)
    let shortId = form.deployment?.shortId;
    if (!shortId) {
      // 8자리 랜덤 문자열 생성
      shortId = Math.random().toString(36).substring(2, 10);
      
      // 중복 체크 (매우 낮은 확률이지만 안전을 위해)
      const existing = await prisma.deployment.findUnique({
        where: { shortId }
      });
      if (existing) {
        shortId = Math.random().toString(36).substring(2, 11);
      }
    }

    // 3. Deployment 정보 업데이트 또는 생성
    const deployment = await prisma.deployment.upsert({
      where: { formId: id },
      update: {
        status: 'published',
        shortId,
        publishedAt: new Date(),
      },
      create: {
        formId: id,
        status: 'published',
        shortId,
        publishedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      shortId: deployment.shortId,
      publishedUrl: `/p/${deployment.shortId}`
    });
  } catch (error) {
    console.error('[API] Failed to publish form:', error);
    return NextResponse.json(
      { error: 'Failed to publish form' },
      { status: 500 }
    );
  }
}
