import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/forms/:id — 개별 폼 조회
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await prisma.form.findUnique({
    where: { id },
  });

  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  // 소유자 확인
  if (form.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    ...form,
    factor: JSON.parse(form.factor),
  });
}

/**
 * PUT /api/forms/:id — 폼 업데이트 (Form Factor 저장)
 * Body: { title?: string, factor?: FormFactor (JSON) }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const existing = await prisma.form.findUnique({ where: { id } });
  if (existing && existing.ownerId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, factor } = body;

    // factor에서 title을 추출하여 DB title 컬럼과 동기화
    const factorObj = typeof factor === 'string' ? JSON.parse(factor) : factor;
    const derivedTitle = title || (factorObj?.metadata?.title) || 'Untitled Form';
    
    const factorString = factor !== undefined 
      ? (typeof factor === 'string' ? factor : JSON.stringify(factor))
      : JSON.stringify({});

    const form = await prisma.form.upsert({
      where: { id },
      update: {
        title: derivedTitle,
        ...(factor !== undefined && {
          factor: factorString,
          version: { increment: 1 },
        }),
      },
      create: {
        id,
        title: derivedTitle,
        factor: factorString,
        ownerId: userId,
      },
    });

    return NextResponse.json({
      ...form,
      factor: JSON.parse(form.factor),
    });
  } catch (error) {
    console.error('[API] Failed to save/update form:', error);
    return NextResponse.json(
      { error: 'Failed to save form' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/forms/:id — 폼 삭제
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existing = await prisma.form.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  if (existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.form.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
