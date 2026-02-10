import { useState, useCallback } from 'react';
import { useFormStore } from '@/store/useFormStore';
import { GeminiProvider, AIResponse } from '@/lib/ai/GeminiProvider';
import { Operation } from 'rfc6902';

export const useAIPatch = () => {
  const { formFactor, addMessage, config } = useFormStore();
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  
  const provider = new GeminiProvider();

  const generatePatch = async (prompt: string): Promise<Operation[] | null> => {
    const result = await generatePatchWithSummary(prompt);
    return result?.patches || null;
  };

  const generatePatchWithSummary = useCallback(async (
    prompt: string,
    useStreaming: boolean = true
  ): Promise<AIResponse | null> => {
    if (!formFactor) return null;
    
    setIsLoading(true);
    setStreamingText('');
    
    try {
      const onSummaryChunk = useStreaming 
        ? (chunk: string) => setStreamingText(prev => prev + chunk)
        : undefined;

      const result = await provider.generatePatchWithSummary(
        prompt, 
        formFactor,
        onSummaryChunk
      );
      
      if (result.patches.length === 0) {
        addMessage({
          role: 'assistant',
          content: result.summary || '죄송합니다. 해당 요청에 맞는 변경 사항을 생성하지 못했습니다.',
        });
        return result;
      }

      return result;
    } catch (error: any) {
      console.error('AI Patch Generation Error:', error);
      addMessage({
        role: 'system_error',
        content: `AI 처리 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
      });
      return null;
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  }, [formFactor, addMessage, provider]);

  return {
    generatePatch,
    generatePatchWithSummary,
    isLoading,
    streamingText,
  };
};
