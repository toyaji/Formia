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

    // 4. Define Strict Block Schema for AI Response Enforcement
    const BlockValueSchema = z.object({
      id: z.string().describe("UUID or random string"),
      type: z.enum(['text', 'textarea', 'choice', 'rating', 'date', 'file', 'info', 'statement']),
      content: z.object({
        label: z.string().describe("The primary question or title text. MANDATORY."),
        placeholder: z.string().optional().describe("Input hint text"),
        helpText: z.string().optional().describe("Small descriptive text below label"),
        options: z.array(z.string()).optional().describe("Array of options for choice type ONLY"),
        maxRating: z.number().optional().describe("Max value for rating type ONLY"),
        body: z.string().optional().describe("Main Markdown body for info/statement types"),
      }),
      validation: z.object({
        required: z.boolean().default(false)
      }).optional(),
      removable: z.boolean().default(true)
    });

    const PageValueSchema = z.object({
      id: z.string(),
      type: z.enum(['start', 'default', 'ending']),
      title: z.string(),
      blocks: z.array(BlockValueSchema).default([])
    });

    const systemPrompt = `
You are an expert AI Form Builder. You generate RFC 6902 JSON patches to modify a **Form Factor v2** schema.

### SCHEMA ARCHITECTURE (v2):
{
  "pages": {
    "start": { "title": "시작 페이지", "blocks": [] },
    "questions": [ { "title": "1페이지", "blocks": [] } ],
    "endings": [ { "title": "종료 페이지", "blocks": [] } ]
  }
}

### BLOCK TYPE REQUIREMENTS:
- 'text'/'textarea': Need 'label', 'placeholder'.
- 'choice': Need 'label', 'options' (Array).
- 'rating': Need 'label', 'maxRating' (Number).
- 'statement'/'info': Need 'label' or 'body'.

### PATH CONVENTIONS:
- Add block to start page: /pages/start/blocks/-
- Add block to first question page: /pages/questions/0/blocks/-
- Update metadata: /metadata/title

### RULES:
1. Every "add" operation for a block MUST have a "value" matching the Block Schema.
2. ❗️IMPORTANT: "content" is an OBJECT, not a string. "label" is INSIDE "content".
3. Use Korean (한국어) for all user-facing strings (label, title, placeholder).

### CURRENT SCHEMA:
${JSON.stringify(currentSchema, null, 2)}
`.trim();

    const { object } = await generateObject({
      model,
      system: systemPrompt,
      messages: chatMessages,
      schema: z.object({
        reasoning: z.string().describe("Plan for the structural changes (In Korean)"),
        summary: z.string().describe("User-facing summary of changes"),
        patches: z.array(
          z.object({
            op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
            path: z.string(),
            value: z.union([BlockValueSchema, PageValueSchema, z.string(), z.number(), z.boolean()]).optional().describe('Patch value. For block additions, must include id, type, and content object.')
          })
        ),
      }),
      temperature: 0.1,
    });

    // [DEBUG]
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n--- 🤖 AI Agent Response ---');
      console.log('🧠 Reasoning:', object.reasoning);
      console.log('🛠️ Patches:', JSON.stringify(object.patches, null, 2));
    }

    return NextResponse.json({
      patches: object.patches || [],
      summary: object.summary || '',
      reasoning: object.reasoning
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
