import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/forms — 로그인 사용자의 폼 목록 조회
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const forms = await prisma.form.findMany({
    where: { ownerId: session.user.id },
    select: {
      id: true,
      title: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(forms);
}

/**
 * POST /api/forms — 새 폼 생성
 * Body: { title: string, factor: FormFactor (JSON) }
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, factor } = body;

    if (!title || !factor) {
      return NextResponse.json(
        { error: 'Missing required fields: title, factor' },
        { status: 400 }
      );
    }

    const form = await prisma.form.create({
      data: {
        title,
        factor: typeof factor === 'string' ? factor : JSON.stringify(factor),
        ownerId: session.user.id,
      },
    });

    return NextResponse.json(form, { status: 201 });
  } catch (error) {
    console.error('[API] Failed to create form:', error);
    return NextResponse.json(
      { error: 'Failed to create form' },
      { status: 500 }
    );
  }
}
