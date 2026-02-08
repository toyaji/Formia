import { AIProvider } from './AIProvider';
import { FormFactor, BlockType } from '../core/schema';
import { Operation } from 'rfc6902';

export interface AIResponse {
  patches: Operation[];
  summary: string;
}

export class GeminiProvider implements AIProvider {
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || null;
  }

  getName(): string {
    return 'Google Gemini';
  }

  async generatePatch(prompt: string, currentSchema: FormFactor): Promise<Operation[]> {
    const result = await this.generatePatchWithSummary(prompt, currentSchema);
    return result.patches;
  }

  async generatePatchWithSummary(
    prompt: string, 
    currentSchema: FormFactor,
    onSummaryChunk?: (chunk: string) => void
  ): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API Key is missing. Please provide it in settings.');
    }

    try {
      // Use streaming if callback provided
      if (onSummaryChunk) {
        return await this.streamGenerate(prompt, currentSchema, onSummaryChunk);
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: this.buildPrompt(prompt, currentSchema) }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            }
          })
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

      // Handle both old format (array) and new format (object with patches and summary)
      if (Array.isArray(result)) {
        return { patches: result, summary: this.generateDefaultSummary(result) };
      }

      if (result.patches && Array.isArray(result.patches)) {
        return { 
          patches: result.patches, 
          summary: result.summary || this.generateDefaultSummary(result.patches) 
        };
      }

      throw new Error('AI returned invalid format');
    } catch (error: any) {
      console.error('[Gemini] Integration Error:', error);
      throw error;
    }
  }

  private async streamGenerate(
    prompt: string,
    currentSchema: FormFactor,
    onSummaryChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: this.buildPrompt(prompt, currentSchema) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Gemini API request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullText = '';
    let summaryStarted = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            fullText += text;
            
            // Try to stream summary as it comes
            if (text.includes('"summary"')) {
              summaryStarted = true;
            }
            if (summaryStarted && text) {
              // Extract summary text pieces as they arrive
              const summaryMatch = text.match(/"summary"\s*:\s*"([^"]*)"/);
              if (summaryMatch) {
                onSummaryChunk(summaryMatch[1]);
              }
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    const cleanJson = fullText.replace(/```json\n?|```/g, '').trim();
    const result = JSON.parse(cleanJson);

    if (Array.isArray(result)) {
      return { patches: result, summary: this.generateDefaultSummary(result) };
    }

    return { 
      patches: result.patches || [], 
      summary: result.summary || this.generateDefaultSummary(result.patches || [])
    };
  }

  private generateDefaultSummary(patches: Operation[]): string {
    const adds = patches.filter(p => p.op === 'add').length;
    const removes = patches.filter(p => p.op === 'remove').length;
    const replaces = patches.filter(p => p.op === 'replace').length;
    
    const parts = [];
    if (adds > 0) parts.push(`${adds}개 추가`);
    if (removes > 0) parts.push(`${removes}개 삭제`);
    if (replaces > 0) parts.push(`${replaces}개 수정`);
    
    return parts.length > 0 ? parts.join(', ') + '했습니다.' : '변경 사항을 적용했습니다.';
  }

  private buildPrompt(userPrompt: string, schema: FormFactor): string {
    return `
You are a "JSON Patch Architect" specialized in Form Design.
Your task is to generate an RFC 6902 JSON Patch array to transform the provided "Form Factor" schema based on user intent.

### FORM FACTOR SCHEMA RULES:
- version: "2.0.0"
- pages: An array of page objects.
  - id: Unique string
  - title: (optional)
  - blocks: An array of block objects.
    - type: 'text' | 'choice' | 'rating' | 'info' | 'textarea' | 'date' | 'file'
    - id: Unique string (random)
    - content:
      - label: (required for input types)
      - placeholder: (optional)
      - options: (required for choice, array of strings)
      - maxRating: (required for rating, number 1-10)
      - body: (required for info, markdown string)

### OUTPUT SPECIFICATION:
Return a JSON object with this structure:
{
  "patches": [ /* RFC 6902 JSON Patch operations */ ],
  "summary": "한국어로 변경 내용을 간결하게 설명 (1-2문장)"
}

- patches: Array of JSON Patch operations (op, path, value/from)
- summary: Brief description of changes in Korean (e.g., "견종 질문에서 '푸들'을 '실버푸들'로 변경하고 '기타' 옵션을 삭제했습니다.")
- Operations should target the "/pages/n/blocks/m" path.
- For new blocks, generate a unique random string for "id".
- **Page Ordering**: If the form has an 'ending' page (type='ending'), insert new generic pages BEFORE it. Do not append after the ending page.
  - e.g. If ending page is at index 2, insert new page at index 2 (shifting ending page to 3).
- **Page Numbering**: Title new pages as "N페이지" starting from 1 (e.g. 1페이지, 2페이지). Do not use "0페이지". Ignore Start/Ending pages for numbering count.

### CURRENT SCHEMA:
${JSON.stringify(schema, null, 2)}

### USER REQUEST:
"${userPrompt}"

JSON Response:`.trim();
  }
}
