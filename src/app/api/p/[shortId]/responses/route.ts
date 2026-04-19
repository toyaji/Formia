import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/p/[shortId]/responses
 * 설문 응답을 전송받아 저장합니다. 로그인 없이 접근 가능합니다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { shortId: string } }
) {
  const { shortId } = params;

  try {
    // 1. 배포 중인 설문인지 확인
    const deployment = await prisma.deployment.findUnique({
      where: { shortId },
      select: { formId: true, status: true }
    });

    if (!deployment || deployment.status !== 'published') {
      return NextResponse.json(
        { error: '설문을 찾을 수 없거나 응답 수집이 중단된 상태입니다.' },
        { status: 404 }
      );
    }

    // 2. 응답 데이터 파싱
    const body = await request.json();
    const { data: responses, metadata } = body;

    if (!responses) {
      return NextResponse.json(
        { error: '응답 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // 3. 응답 데이터 생성
    const response = await prisma.response.create({
      data: {
        formId: deployment.formId,
        data: typeof responses === 'string' ? responses : JSON.stringify(responses),
        metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
      }
    });

    return NextResponse.json({
      success: true,
      id: response.id
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Failed to save response:', error);
    return NextResponse.json(
      { error: '응답 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
