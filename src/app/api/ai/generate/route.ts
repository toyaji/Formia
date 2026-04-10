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

    const systemPrompt = `
You are a "JSON Patch Architect" specialized in Form Design.
Your task is to review the user's intent within the conversation history, and generate JSON Patches to transform the provided "Form Factor" schema.

### SCHEMA SPECIFICATION:
1. "text": Short text input. { "label": "string", "placeholder": "string?", "helpText": "string?" }
2. "textarea": Long text area. { "label": "string", "placeholder": "string?", "helpText": "string?" }
3. "choice": Multiple choice or checkbox. { "label": "string", "options": ["string"], "multiSelect": boolean?, "allowOther": boolean?, "helpText": "string?" }
4. "rating": Star rating. { "label": "string", "maxRating": number?, "helpText": "string?" }
5. "date": Date picker. { "label": "string", "helpText": "string?" }
6. "file": File upload. { "label": "string", "helpText": "string?" }
7. "info": Informational markdown. { "label": "string?", "body": "string" }
8. "statement": Centered heading/text (start/end pages). { "label": "string?", "body": "string" }
 
❗️ IMPORTANT SCHEMA CONSTRAINTS:
- For ALL blocks (except 'start'/'ending' pages), you MUST provide a "label" under "content". Without "label", the UI will show "제목 없음" (Empty Title).
- The "label" MUST be descriptive and in Korean (e.g., "이름을 입력해주세요").
- Do NOT generate empty objects. Every added block must have "id", "type", and "content".
 
### VALID PAGE STRUCTURE:
{
  "id": "string",
  "type": "start" | "default" | "ending",
  "title": "string",
  "blocks": []
}

### JSON PATCH RULES:
- Use RFC 6902 operations (add, remove, replace, move, copy, test).
- To add a block: {"op": "add", "path": "/pages/{pageIndex}/blocks/-", "value": { "id": "random_id", "type": "BLOCK_TYPE", "content": { ... }, "validation": { "required": false } }}
- To update a field: {"op": "replace", "path": "/pages/{pageIndex}/blocks/{blockIndex}/content/label", "value": "New Label"}
- To remove a block: {"op": "remove", "path": "/pages/{pageIndex}/blocks/{blockIndex}"}

### CONSTRAINTS:
- DO NOT use block types other than those listed above (e.g., NO "shortText", "email", etc. Use "text" instead).
- Always generate unique "id" for new blocks.
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
            value: z.any().optional()
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
