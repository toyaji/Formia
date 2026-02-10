import { AIProvider } from './AIProvider';
import { FormFactor } from '../core/schema';
import { Operation } from 'rfc6902';
import { validatePatchesDetailed } from '../utils/patchValidator';

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
    onSummaryChunk?: (chunk: string) => void,
    retryCount = 0
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

      const data = await response.json();
      const patches = data.patches || [];
      
      // Detailed validation
      const { validPatches, errors } = validatePatchesDetailed(patches, currentSchema);
      
      // If there are validation errors and we haven't retried yet, try again with feedback
      if (errors.length > 0 && retryCount === 0) {
        console.warn('[Gemini] Validation failed, retrying with feedback:', errors);
        const feedbackPrompt = `${prompt}\n\nIMPORTANT: Your previous response had some issues. Please fix them:\n- ${errors.join('\n- ')}\n\nPlease try again and ensure all required fields (id, type, content, title, blocks, etc.) are included for new elements.`;
        return this.generatePatchWithSummary(feedbackPrompt, currentSchema, onSummaryChunk, 1);
      }

      if (onSummaryChunk && data.summary) {
        onSummaryChunk(data.summary);
      }

      return { 
        patches: validPatches, 
        summary: data.summary || (validPatches.length === 0 ? '변경 사항을 생성하지 못했습니다.' : '')
      };
    } catch (error: any) {
      console.error('[Gemini] Proxy Connection Error:', error);
      throw error;
    }
  }
}

