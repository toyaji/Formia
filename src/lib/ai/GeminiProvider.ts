import { AIProvider } from './AIProvider';
import { FormFactor, BlockType } from '../core/schema';
import { Operation } from 'rfc6902';

export class GeminiProvider implements AIProvider {
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    // [PLACEHOLDER] In a real app, this would be retrieved from secure storage or .env
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || null;
  }

  getName(): string {
    return 'Google Gemini';
  }

  async generatePatch(prompt: string, currentSchema: FormFactor): Promise<Operation[]> {
    if (!this.apiKey) {
      throw new Error('Gemini API Key is missing. Please provide it in settings.');
    }

    console.log(`[Gemini] Processing prompt: ${prompt}`);
    
    // [PLACEHOLDER] In a real app, we would call the Gemini API here.
    // We would provide the system prompt, current schema, and user prompt.
    // The response would be parsed as a JSON Patch array.

    /*
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=' + this.apiKey, {
      method: 'POST',
      body: JSON.stringify({
        contents: [{ parts: [{ text: this.buildPrompt(prompt, currentSchema) }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    */

    // Returning a dummy patch for verification in placeholder mode
    if (prompt.includes('추가')) {
      let content: any = { label: '새로운 필드', placeholder: '내용을 입력하세요.' };
      let type: BlockType = 'text';

      if (prompt.includes('연령') || prompt.includes('나이')) {
        type = 'choice';
        content = { label: '연령대', options: ['10대', '20대', '30대', '40대 이상'] };
      } else if (prompt.includes('연락처') || prompt.includes('전화')) {
        type = 'text';
        content = { label: '연락처', placeholder: '010-0000-0000' };
      }

      return [{
        op: 'add',
        path: '/blocks/-',
        value: {
          id: Math.random().toString(36).substring(7),
          type,
          content
        }
      }];
    }
    
    if (prompt.includes('삭제') && currentSchema.blocks.length > 0) {
      return [{
        op: 'remove',
        path: '/blocks/0'
      }];
    }

    return [];
  }

  private buildPrompt(userPrompt: string, schema: FormFactor): string {
    return `
      You are an AI Form Architect. Your goal is to modify the provided Form Factor JSON schema.
      Current Schema: ${JSON.stringify(schema)}
      User Request: ${userPrompt}
      
      Output MUST be a valid JSON Patch (RFC 6902) array.
    `.trim();
  }
}
