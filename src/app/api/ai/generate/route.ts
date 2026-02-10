import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * POST /api/ai/generate — AI Proxy 엔드포인트
 *
 * 클라이언트의 AI 요청을 서버에서 대신 처리합니다.
 * API 키는 서버 환경변수에서만 읽히며 클라이언트에 노출되지 않습니다.
 *
 * Body: {
 *   prompt: string,
 *   currentSchema: FormFactor (JSON),
 *   provider?: 'gemini' | 'openai' | 'anthropic'
 * }
 *
 * Response: {
 *   patches: Operation[],
 *   summary: string
 * }
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { prompt, currentSchema, provider = 'gemini' } = body;

    if (!prompt || !currentSchema) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt, currentSchema' },
        { status: 400 }
      );
    }

    // 서버 사이드에서 API 키 조회 (NEXT_PUBLIC_ 접두사 없음 → 클라이언트에 노출되지 않음)
    const apiKey = getApiKey(provider);

    if (!apiKey) {
      return NextResponse.json(
        { error: `API key not configured for provider: ${provider}. Set the corresponding environment variable on the server.` },
        { status: 500 }
      );
    }

    // provider에 따라 적절한 AI 서비스 호출
    const result = await callAIProvider(provider, apiKey, prompt, currentSchema);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[AI Proxy] Error:', error);
    return NextResponse.json(
      { error: error.message || 'AI generation failed' },
      { status: 500 }
    );
  }
}

/**
 * 서버 환경변수에서 API 키를 가져옵니다.
 * NEXT_PUBLIC_ 접두사가 없으므로 클라이언트 번들에 포함되지 않습니다.
 */
function getApiKey(provider: string): string | undefined {
  switch (provider) {
    case 'gemini':
      return process.env.GEMINI_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    default:
      return undefined;
  }
}

/**
 * AI 프로바이더별 API 호출
 */
async function callAIProvider(
  provider: string,
  apiKey: string,
  prompt: string,
  currentSchema: any
) {
  switch (provider) {
    case 'gemini':
      return callGemini(apiKey, prompt, currentSchema);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Gemini API 직접 호출 (서버 사이드)
 * GeminiProvider.ts의 로직을 서버로 이전한 것
 */
async function callGemini(apiKey: string, prompt: string, currentSchema: any) {
  const systemPrompt = buildGeminiPrompt(prompt, currentSchema);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Gemini API request failed');
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error('No response from Gemini');
  }

  const cleanJson = textResponse.replace(/```json\n?|```/g, '').trim();
  const result = JSON.parse(cleanJson);

  // GeminiProvider와 동일한 응답 포맷 처리
  if (Array.isArray(result)) {
    return { patches: result, summary: '' };
  } else if (result.patches && Array.isArray(result.patches)) {
    return { patches: result.patches, summary: result.summary || '' };
  } else {
    throw new Error('AI returned invalid format');
  }
}

/**
 * Gemini 프롬프트 구성 (GeminiProvider.buildPrompt 로직 재사용)
 * 전체 프롬프트는 클라이언트의 GeminiProvider.buildPrompt()와 동일한 구조
 */
function buildGeminiPrompt(userPrompt: string, schema: any): string {
  return `You are an AI assistant for a form builder application.
Your task is to modify the form structure based on user instructions.

CURRENT FORM STATE (JSON):
${JSON.stringify(schema, null, 2)}

USER REQUEST:
${userPrompt}

INSTRUCTIONS:
- Return a JSON object with "patches" (array of RFC 6902 JSON Patch operations) and "summary" (brief description of changes in Korean).
- Each patch must have "op", "path", and "value" (for add/replace) properties.
- Valid operations: "add", "remove", "replace"
- Paths reference the form structure (e.g., "/pages/0/blocks/0/props/title")
- Ensure all patches are valid against the current schema.

RESPONSE FORMAT:
{
  "patches": [
    { "op": "replace", "path": "/pages/0/blocks/0/props/title", "value": "New Title" }
  ],
  "summary": "제목을 'New Title'로 변경했습니다."
}`;
}
