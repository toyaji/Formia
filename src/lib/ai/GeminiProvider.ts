import { AIProvider } from './AIProvider';
import { FormFactor } from '../core/schema';
import { Operation } from 'rfc6902';
import { validatePatchesDetailed } from '../utils/patchValidator';
import { Message } from '@/store/useFormStore';

export interface AIResponse {
  patches: Operation[];
  summary: string;
}

export class GeminiProvider implements AIProvider {
  getName(): string {
    return 'Google Gemini';
  }

  async generatePatch(prompt: string, currentSchema: FormFactor, messages: Message[] = []): Promise<Operation[]> {
    const result = await this.generatePatchWithSummary(prompt, currentSchema, messages);
    return result.patches;
  }

  async generatePatchWithSummary(
    prompt: string, 
    currentSchema: FormFactor,
    messages: Message[] = [],
    onSummaryChunk?: (chunk: string) => void,
    retryCount = 0
  ): Promise<AIResponse> {
    try {
      // Append the latest prompt to the messages if it's not already the last message
      const latestMessages = [...messages];
      if (latestMessages.length === 0 || latestMessages[latestMessages.length - 1].content !== prompt) {
        latestMessages.push({ id: 'temp', role: 'user', content: prompt, timestamp: new Date().toISOString() });
      }

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          messages: latestMessages.map(m => ({ role: m.role.replace('system_error', 'system').replace('system_info', 'system'), content: m.content })),
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
      
      const { validPatches, errors } = validatePatchesDetailed(patches, currentSchema);
      
      if (errors.length > 0 && retryCount === 0) {
        console.warn('[Gemini] Validation failed, retrying with feedback:', errors);
        const feedbackPrompt = `${prompt}\n\nIMPORTANT: Your previous response had some issues. Please fix them:\n- ${errors.join('\n- ')}\n\nPlease try again and ensure all required fields (id, type, content, title, blocks, etc.) are included for new elements.`;
        return this.generatePatchWithSummary(feedbackPrompt, currentSchema, messages, onSummaryChunk, 1);
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
