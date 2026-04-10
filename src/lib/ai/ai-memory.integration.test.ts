import { describe, it, expect } from 'vitest';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { config } from 'dotenv';
import path from 'path';

// Load .env.local explicitly assuming it's in the project root
config({ path: path.resolve(__dirname, '../../../.env.local') });

describe('AI Memory Integration (Stateful)', () => {
  it('should remember the context from previous messages', async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('Skipping test: GEMINI_API_KEY not found in .env.local');
      return;
    }

    const extGoogle = createGoogleGenerativeAI({ apiKey });
    const model = extGoogle('gemini-2.0-flash');

    const schemaDefinition = z.object({
      summary: z.string(),
      patches: z.array(z.object({
        op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
        path: z.string(),
        value: z.any().optional()
      }))
    });

    // 1. Initial Prompt
    const messages: { role: 'user' | 'assistant' | 'system', content: string }[] = [
      { role: 'user', content: '텍스트 입력을 하나 추가해줘.' }
    ];

    const { object: firstResponse } = await generateObject({
      model,
      system: 'You are a JSON Patch generator.',
      messages,
      schema: schemaDefinition,
    });

    expect(firstResponse.patches.length).toBeGreaterThan(0);
    // Assistant replies what it did
    messages.push({ role: 'assistant', content: JSON.stringify(firstResponse.patches) });

    // 2. Follow-up Prompt demonstrating memory
    messages.push({ role: 'user', content: '방금 만든 텍스트 입력 블록의 레이블을 "이름입력"으로 수정해줘.' });

    const { object: secondResponse } = await generateObject({
      model,
      system: 'You are a JSON Patch generator.',
      messages,
      schema: schemaDefinition,
    });

    expect(secondResponse.summary).toBeDefined();
    expect(secondResponse.patches.length).toBeGreaterThan(0);

    // If it understood "방금 만든 텍스트 입력" (the text block just made), it proves memory is working.
    // The previous patches contain the random ID generated. If it attempts to use that ID or index, memory works.
    console.log('--- First Action ---');
    console.log(firstResponse.patches);
    console.log('--- Second Action (Memory Test) ---');
    console.log(secondResponse.patches);
    console.log('--- Summary ---');
    console.log(secondResponse.summary);
  }, 30000); // Give it a 30 second timeout for 2 API calls
});
