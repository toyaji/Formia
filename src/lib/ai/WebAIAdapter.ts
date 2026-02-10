import { AIProvider } from './AIProvider';
import { FormFactor } from '../core/schema';
import { Operation } from 'rfc6902';

/**
 * Web AI Adapter — 웹 클라이언트용 AIProvider 구현체
 *
 * AI 요청을 /api/ai/generate 프록시 엔드포인트로 보냅니다.
 * API 키는 서버에서만 사용되므로 클라이언트에 노출되지 않습니다.
 */
export class WebAIAdapter implements AIProvider {
  private endpoint: string;

  constructor(endpoint: string = '/api/ai/generate') {
    this.endpoint = endpoint;
  }

  getName(): string {
    return 'Web AI Proxy';
  }

  async generatePatch(
    prompt: string,
    currentSchema: FormFactor
  ): Promise<Operation[]> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        currentSchema,
        provider: 'gemini',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `AI request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.patches;
  }
}
