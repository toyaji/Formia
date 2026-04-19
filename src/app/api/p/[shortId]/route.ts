import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/p/[shortId]
 * 공개된 설문의 정의(Form Factor)를 조회합니다. 로그인 없이 접근 가능합니다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { shortId: string } }
) {
  const { shortId } = params;

  try {
    const deployment = await prisma.deployment.findUnique({
      where: { shortId },
      include: {
        form: {
          select: {
            id: true,
            title: true,
            factor: true,
            version: true,
          }
        }
      }
    });

    if (!deployment || deployment.status !== 'published') {
      return NextResponse.json(
        { error: '설문을 찾을 수 없거나 배포 중단된 상태입니다.' },
        { status: 404 }
      );
    }

    // SQLite의 경우 JSON이 문자열로 저장되어 있을 수 있으므로 파싱 처리
    let formFactor = deployment.form.factor;
    if (typeof formFactor === 'string') {
      try {
        formFactor = JSON.parse(formFactor);
      } catch (e) {
        console.error('Failed to parse form factor JSON:', e);
      }
    }

    return NextResponse.json({
      id: deployment.form.id,
      title: deployment.form.title,
      factor: formFactor,
    });
  } catch (error) {
    console.error('[API] Failed to fetch public form:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
