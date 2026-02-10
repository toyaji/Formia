import { AIProvider } from './AIProvider';
import { FormFactor } from '../core/schema';
import { Operation } from 'rfc6902';
import { validatePatches } from '../utils/patchValidator';

export interface AIResponse {
  patches: Operation[];
  summary: string;
}

export class GeminiProvider implements AIProvider {
  getName(): string {
    return 'Google Gemini';
  }

  async generatePatch(prompt: string, currentSchema: FormFactor): Promise<Operation[]> {
    const result = await this.generatePatchWithSummary(prompt, currentSchema);
    return result.patches;
  }

  /**
   * AI Proxy(/api/ai/generate)를 통해 AI 응답을 생성합니다.
   * 이제 클라이언트 사이드에서는 API 키를 직접 다루지 않습니다.
   */
  async generatePatchWithSummary(
    prompt: string, 
    currentSchema: FormFactor,
    onSummaryChunk?: (chunk: string) => void
  ): Promise<AIResponse> {
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          currentSchema,
          provider: 'gemini'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI Proxy request failed');
      }

      // Handle streaming if onSummaryChunk is provided
      // Note: Current AI Proxy simple implementation doesn't stream yet, 
      // but the UI expects this pattern. In a future iteration, the proxy
      // should support readable streams.
      const data = await response.json();
      
      const validatedPatches = validatePatches(data.patches || [], currentSchema);
      
      if (onSummaryChunk && data.summary) {
        onSummaryChunk(data.summary);
      }

      return { 
        patches: validatedPatches, 
        summary: data.summary || ''
      };
    } catch (error: any) {
      console.error('[Gemini] Proxy Connection Error:', error);
      throw error;
    }
  }
}

