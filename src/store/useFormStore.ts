import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FormFactor } from '@/lib/core/schema';
import { applyPatch, Operation } from 'rfc6902';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system_error' | 'system_info';
  content: string;
  timestamp: string;
}

interface AppConfig {
  geminiApiKey: string | null;
}

interface FormState {
  formFactor: FormFactor | null;
  activePageId: string | null;
  setActivePageId: (id: string | null) => void;
  activeBlockId: string | null;
  setActiveBlockId: (id: string | null) => void;
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
  
  // History
  history: FormFactor[];
  future: FormFactor[];
  undo: () => void;
  redo: () => void;
  recordAction: () => void;
  
  // Settings
  config: AppConfig;
  setConfig: (config: Partial<AppConfig>) => void;
  
  // Viewport
  viewport: 'desktop' | 'mobile';
  setViewport: (viewport: 'desktop' | 'mobile') => void;
}

export const useFormStore = create<FormState>()(
  persist(
    (set: any, get: any): FormState => ({
      formFactor: null as FormFactor | null,
      activePageId: null as string | null,
      activeBlockId: null as string | null,
      isDraft: false,
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: '안녕하세요! 어떤 폼을 만들고 싶으신가요?',
          timestamp: new Date().toISOString(),
        }
      ],

      setActivePageId: (id: string | null) => set({ activePageId: id, activeBlockId: null }),
      setActiveBlockId: (id: string | null) => set({ activeBlockId: id }),
      setFormFactor: (factor: FormFactor) => {
        set({ formFactor: factor });
        if (factor.pages.length > 0 && !get().activePageId) {
          set({ activePageId: factor.pages[0].id });
        }
      },

  applyJsonPatch: (patches: Operation[]) => {
    get().recordAction();
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

  // History Implementation
  history: [],
  future: [],

  recordAction: () => {
    const { formFactor, history } = get();
    if (!formFactor) return;
    
    // Max history size 50
    const nextHistory = [JSON.parse(JSON.stringify(formFactor)), ...history].slice(0, 50);
    set({ history: nextHistory, future: [] });
  },

  undo: () => {
    const { history, future, formFactor } = get();
    if (history.length === 0 || !formFactor) return;

    const previous = history[0];
    const newHistory = history.slice(1);
    const newFuture = [JSON.parse(JSON.stringify(formFactor)), ...future];

    set({
      formFactor: previous,
      history: newHistory,
      future: newFuture
    });
  },

  redo: () => {
    const { history, future, formFactor } = get();
    if (future.length === 0 || !formFactor) return;

    const next = future[0];
    const newFuture = future.slice(1);
    const newHistory = [JSON.parse(JSON.stringify(formFactor)), ...history];

      set({
        formFactor: next,
        history: newHistory,
        future: newFuture
      });
    },

    // Settings
    config: {
      geminiApiKey: null,
    },
    setConfig: (newConfig: Partial<AppConfig>) => set((state: FormState) => ({
      config: { ...state.config, ...newConfig }
    })),

    // Viewport
    viewport: 'desktop',
    setViewport: (viewport: 'desktop' | 'mobile') => set({ viewport }),
  }),
  {
    name: 'formia-storage',
    partialize: (state) => ({ 
      config: state.config,
    }),
  }
)
);
