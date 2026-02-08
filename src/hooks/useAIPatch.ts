import { useState } from 'react';
import { useFormStore } from '@/store/useFormStore';
import { GeminiProvider } from '@/lib/ai/GeminiProvider';
import { Operation } from 'rfc6902';

export const useAIPatch = () => {
  const { formFactor, addMessage } = useFormStore();
  const [isLoading, setIsLoading] = useState(false);
  
  // Singleton provider for now
  const provider = new GeminiProvider();

  const generatePatch = async (prompt: string): Promise<Operation[] | null> => {
    if (!formFactor) return null;
    
    setIsLoading(true);
    try {
      const patches = await provider.generatePatch(prompt, formFactor);
      
      if (patches.length === 0) {
        addMessage({
          role: 'assistant',
          content: '죄송합니다. 해당 요청에 맞는 변경 사항을 생성하지 못했습니다.',
        });
        return null;
      }

      return patches;
    } catch (error: any) {
      console.error('AI Patch Generation Error:', error);
      addMessage({
        role: 'assistant',
        content: `오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    generatePatch,
    isLoading,
  };
};
