import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/utils/encryption';
import { cookies } from 'next/headers';

const SESSION_SECRET_KEY = process.env.SESSION_SECRET_KEY || 'default-session-secret-change-me-in-prod';

/**
 * POST /api/ai/generate — AI Proxy 엔드포인트
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  
  try {
    const body = await request.json();
    const { prompt, currentSchema, provider = 'gemini' } = body;

    if (!prompt || !currentSchema) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt, currentSchema' },
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

    // 3. Call AI Provider
    const result = await callAIProvider(provider, apiKey, prompt, currentSchema);

    // ⚠️ Security: Clear key from memory (best effort)
    apiKey = "";

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
 * Retrieves the effective API key for the current request
 */
async function getEffectiveKey(provider: string, userId?: string): Promise<string | null> {
  // Mode B: Logged-in user DB secret
  if (userId) {
    const dbSecret = await prisma.userSecret.findUnique({
      where: { userId_provider: { userId, provider } }
    });
    
    if (dbSecret) {
      // Note: In Mode B, the secret key used for encryption might be user-specific
      // For now, using a system-wide encryption key or user-derived if implemented
      // Assuming system-wide key for simplicity of this implementation, but plan mentioned user-derived.
      // If user-derived (password based), we'd need the password/key in session.
      // For this implementation, we'll use SESSION_SECRET_KEY as placeholder or separate DB_SECRET_KEY.
      const DB_SECRET_KEY = process.env.DB_SECRET_KEY || SESSION_SECRET_KEY;
      try {
        return decrypt(dbSecret.encryptedKey, dbSecret.iv, dbSecret.salt, DB_SECRET_KEY);
      } catch (e) {
        console.error('Failed to decrypt DB secret:', e);
      }
    }
  }

  // Mode A: Session cookie (Non-logged-in or fallback)
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

  if (Array.isArray(result)) {
    return { patches: result, summary: '' };
  } else if (result.patches && Array.isArray(result.patches)) {
    return { patches: result.patches, summary: result.summary || '' };
  } else {
    throw new Error('AI returned invalid format');
  }
}

/**
 * Re-using the prompt from GeminiProvider.ts for consistency
 */
function buildGeminiPrompt(userPrompt: string, schema: any): string {
  return `
You are a "JSON Patch Architect" specialized in Form Design.
Your task is to generate an RFC 6902 JSON Patch array to transform the provided "Form Factor" schema based on user intent.

### VALID BLOCK TYPES AND STRUCTURES:
1. "text": Short text input. { "label": "string", "placeholder": "string?", "helpText": "string?" }
2. "textarea": Long text area. { "label": "string", "placeholder": "string?", "helpText": "string?" }
3. "choice": Multiple choice or checkbox. { "label": "string", "options": ["string"], "multiSelect": boolean?, "allowOther": boolean?, "helpText": "string?" }
4. "rating": Star rating. { "label": "string", "maxRating": number?, "helpText": "string?" }
5. "date": Date picker. { "label": "string", "helpText": "string?" }
6. "file": File upload. { "label": "string", "helpText": "string?" }
7. "info": Informational markdown. { "label": "string?", "body": "string" }
8. "statement": Centered heading/text (start/end pages). { "label": "string?", "body": "string" }

### JSON PATCH RULES:
- Use RFC 6902 operations (add, remove, replace, move, copy, test).
- To add a block to a page: {"op": "add", "path": "/pages/{pageIndex}/blocks/-", "value": { "id": "random_id", "type": "BLOCK_TYPE", "content": { ... }, "validation": { "required": false } }}
- To update a field: {"op": "replace", "path": "/pages/{pageIndex}/blocks/{blockIndex}/content/label", "value": "New Label"}
- To remove a block: {"op": "remove", "path": "/pages/{pageIndex}/blocks/{blockIndex}"}

### CONSTRAINTS:
- DO NOT use block types other than those listed above (e.g., NO "shortText", "email", etc. Use "text" instead).
- Always generate unique "id" for new blocks.
- Ensure the resulting schema remains valid.

### OUTPUT SPECIFICATION:
Return a JSON object with this structure:
{
  "patches": [ /* RFC 6902 JSON Patch operations */ ],
  "summary": "한국어로 변경 내용을 간결하게 설명 (1-2문장) 또는 변경 불가 사유"
}

### CURRENT SCHEMA:
${JSON.stringify(schema, null, 2)}

### USER REQUEST:
"${userPrompt}"

JSON Response:`.trim();
}
