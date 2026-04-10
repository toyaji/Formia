import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/utils/encryption';
import { cookies } from 'next/headers';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

const SESSION_SECRET_KEY = process.env.SESSION_SECRET_KEY || 'default-session-secret-change-me-in-prod';

/**
 * POST /api/ai/generate — Stateful AI Proxy using Vercel AI SDK
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  
  try {
    const body = await request.json();
    const { messages, currentSchema, provider = 'gemini' } = body;

    // Backward compatibility for old prompt structure
    const chatMessages = messages || (body.prompt ? [{ role: 'user', content: body.prompt }] : []);

    if (!chatMessages.length || !currentSchema) {
      return NextResponse.json(
        { error: 'Missing required fields: messages, currentSchema' },
        { status: 400 }
      );
    }

    // 1. Get API Key from Session (Mode A) or DB (Mode B)
    let apiKey: string | null = await getEffectiveKey(provider, session?.user?.id);

    // 2. If no user key, fallback to server default (if any)
    if (!apiKey) {
      apiKey = getDefaultKey(provider) || null;
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: `API key not configured for ${provider}. Please provide it in settings.` },
        { status: 401 }
      );
    }

    // 3. Setup Vercel AI Provider Instances
    const extOpenAI = createOpenAI({ apiKey });
    // Note: If using gemini-2.0-flash, keep in mind we need the latest SDK version. Let's use standard gemini-1.5-pro or 2.0-flash
    const extGoogle = createGoogleGenerativeAI({ apiKey });

    const model = provider === 'openai' 
      ? extOpenAI('gpt-4o')
      : extGoogle('gemini-2.0-flash');

    const hasQuestions = currentSchema.pages?.questions?.length > 0;
    const targetPath = hasQuestions ? "/pages/questions/0/blocks" : "/pages/start/blocks";

    const systemPrompt = `
You are a brilliant UI/UX web designer acting as an AI Form Builder.
You generate RFC 6902 JSON patch operations to modify the form schema according to user requests.
Always respond in Korean. Add emojis where appropriate in your summary.

### BLOCK SCHEMA STRUCTURE:
When you create a new block (using the "add" operation), its "value" MUST EXACTLY match this strict JSON structure:
{
  "id": "must_be_random_unique_string",
  "type": "text", // (or "textarea", "choice", "rating", "date", "file", "info", "statement")
  "content": {
    "label": "이름을 입력해주세요", // ❗️CRITICAL: This is the actual question/title text! MUST be inside "content" object.
    "placeholder": "예: 홍길동", // Optional.
    "helpText": "정확한 실명을 입력해주세요.", // Optional.
    "options": ["옵션1", "옵션2"] // ONLY for "choice" type!
  },
  "validation": {
    "required": true // Boolean. Set to true if the user must fill this out.
  }
}

❗️ IMPORTANT SCHEMA CONSTRAINTS:
- For ALL blocks (except 'start'/'ending' pages), you MUST provide a "label" under "content". Without "label", the UI will show "제목 없음" (Empty Title).
- The "label" MUST be descriptive and in Korean. This serves as the title of the question.
- "content" MUST ALWAYS be an object `{ ... }`, NEVER a string!
- "validation" MUST ALWAYS be an object `{ ... }`, NEVER a string!
- Do NOT generate empty objects. Every added block must have "id", "type", and "content" with "label".

### JSON PATCH RULES:
- Use RFC 6902 operations (add, remove, replace, move, copy, test).
- ❗️CRITICAL: To add a new question/input block, you MUST generate an "add" patch aiming EXACTLY at:
  {"op": "add", "path": "${targetPath}/-", "value": { "id": "random_id", "type": "BLOCK_TYPE", "content": { "label": "Descriptive Label" }, "validation": { "required": false } }}
- To update a field: {"op": "replace", "path": "${targetPath}/{blockIndex}/content/label", "value": "New Label"}
- To remove a block: {"op": "remove", "path": "${targetPath}/{blockIndex}"}
- ❗️CRITICAL: Do NOT just update metadata. You MUST create the actual UI blocks necessary for the user's request. Generate multiple "add" patches if multiple fields are needed.

### CONSTRAINTS:
- DO NOT use block types other than those listed above (e.g., NO "shortText", "email", etc. Use "text" instead).
- Always generate unique random strings for the "id" of new blocks.
- Ensure the resulting schema remains valid.

### CURRENT SCHEMA:
${JSON.stringify(currentSchema, null, 2)}
`.trim();

    // 4. Generate Object with memory context
    const { object } = await generateObject({
      model,
      system: systemPrompt,
      messages: chatMessages,
      schema: z.object({
        summary: z.string().describe("한국어로 변경 내용을 간결하게 설명하는 메시지 (대화형 식 1-2문장) 또는 변경 불가 사유. 답변은 assistant로서 사용자와 소통하듯이 자연스럽게 작성하세요."),
        patches: z.array(
          z.object({
            op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
            path: z.string(),
            value: z.any().optional().describe('If op is "add" or "replace", value must contain "content": { "label": "Text" }. Never omit the label for new UI blocks.')
          })
        ).describe("Array of RFC 6902 JSON patch operations corresponding to the fix. Return empty array if no change is needed."),
      }),
      temperature: 0.1,
    });

    // ⚠️ Security: Clear key from memory (best effort)
    apiKey = "";

    return NextResponse.json({
      patches: object.patches || [],
      summary: object.summary || ''
    });
  } catch (error: any) {
    console.error('[AI Proxy] Error:', error);
    return NextResponse.json(
      { error: error.message || 'AI generation failed' },
      { status: 500 }
    );
  }
}

/**
 * Retrieves the effective API key for the current request
 */
async function getEffectiveKey(provider: string, userId?: string): Promise<string | null> {
  if (userId) {
    const dbSecret = await prisma.userSecret.findUnique({
      where: { userId_provider: { userId, provider } }
    });
    
    if (dbSecret) {
      const DB_SECRET_KEY = process.env.DB_SECRET_KEY || SESSION_SECRET_KEY;
      try {
        return decrypt(dbSecret.encryptedKey, dbSecret.iv, dbSecret.salt, DB_SECRET_KEY);
      } catch (e) {
        console.error('Failed to decrypt DB secret:', e);
      }
    }
  }

  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(`secret_${provider}`);
  if (sessionCookie) {
    try {
      const { encryptedData, iv, salt } = JSON.parse(sessionCookie.value);
      return decrypt(encryptedData, iv, salt, SESSION_SECRET_KEY);
    } catch (e) {
      console.error('Failed to decrypt session secret:', e);
    }
  }

  return null;
}

function getDefaultKey(provider: string): string | undefined {
  switch (provider) {
    case 'gemini': return process.env.GEMINI_API_KEY;
    case 'openai': return process.env.OPENAI_API_KEY;
    case 'anthropic': return process.env.ANTHROPIC_API_KEY;
    default: return undefined;
  }
}
