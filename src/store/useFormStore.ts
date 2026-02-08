import { create } from 'zustand';
import { FormFactor } from '@/lib/core/schema';
import { applyPatch, Operation } from 'rfc6902';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface FormState {
  formFactor: FormFactor | null;
  setFormFactor: (factor: FormFactor) => void;
  applyJsonPatch: (patches: Operation[]) => void;
  isDraft: boolean;
  setDraft: (isDraft: boolean) => void;
  messages: Message[];
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  proposedPatches: Operation[] | null;
  setProposedPatches: (patches: Operation[] | null) => void;
  getEffectiveFactor: () => FormFactor | null;
}

export const useFormStore = create<FormState>((set: any, get: any) => ({
  formFactor: null,
  isDraft: false,
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: '안녕하세요! 어떤 폼을 만들고 싶으신가요?',
      timestamp: new Date().toISOString(),
    }
  ],

  setFormFactor: (factor: FormFactor) => set({ formFactor: factor }),

  applyJsonPatch: (patches: Operation[]) => {
    const current = get().formFactor;
    if (!current) return;

    // We clone the state to avoid direct mutation
    const next = JSON.parse(JSON.stringify(current));
    const results = applyPatch(next, patches);

    // Check if all patches were applied successfully
    const allSuccessful = results.every((r: any) => r === null);

    if (allSuccessful) {
      set({ formFactor: next });
    } else {
      console.error('Failed to apply some patches:', results);
    }
  },

  setDraft: (isDraft: boolean) => set({ isDraft }),

  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
    };
    set((state: FormState) => ({
      messages: [...state.messages, newMessage],
    }));
  },

  clearMessages: () => set({ messages: [] }),

  proposedPatches: null,
  setProposedPatches: (patches: Operation[] | null) => set({ proposedPatches: patches }),

  getEffectiveFactor: () => {
    const { formFactor, proposedPatches } = get();
    if (!formFactor) return null;
    if (!proposedPatches || proposedPatches.length === 0) return formFactor;

    // Create a temporary clone and apply proposed patches for preview
    const preview = JSON.parse(JSON.stringify(formFactor));
    applyPatch(preview, proposedPatches);
    return preview;
  },
}));
