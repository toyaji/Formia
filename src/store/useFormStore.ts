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

// Phase 13: Patch item for inline diff review
export interface PatchItem {
  id: string;
  patch: Operation;
  status: 'pending' | 'accepted' | 'rejected';
  targetBlockId?: string;
  changeType: 'add' | 'remove' | 'replace';
  // Field-level targeting: 'label', 'options/0', 'options/1', 'block' (entire block)
  targetField?: string;
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
  
  // Phase 13: Review Mode
  isReviewMode: boolean;
  setReviewMode: (mode: boolean) => void;
  pendingPatches: PatchItem[];
  setPendingPatches: (patches: PatchItem[]) => void;
  acceptPatch: (patchId: string) => void;
  rejectPatch: (patchId: string) => void;
  acceptPatchesByBlockId: (blockId: string) => void;
  rejectPatchesByBlockId: (blockId: string) => void;
  acceptAllPatches: () => void;
  rejectAllPatches: () => void;
  preReviewSnapshot: FormFactor | null;
  saveSnapshot: () => void;
  restoreSnapshot: () => void;
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
    const { formFactor, pendingPatches } = get();
    if (!formFactor) return null;
    
    // Use pending patches instead of proposedPatches
    // Filter only patches that are still pending
    const activePatches = pendingPatches.filter((p: PatchItem) => p.status === 'pending');
    
    if (activePatches.length === 0) return formFactor;

    // Create a temporary clone and apply pending patches for preview
    // Note: Patches must be applied in order, but we filter out accepted/rejected.
    // If patches were generated sequentially, applying later patches on top of (accepted + pending) state should work
    // IF the accepted patches didn't change the path structure in a way that invalidates pending patches.
    // Given AI usually generates a sequence of operations, this is the best effort preview logic.
    const preview = JSON.parse(JSON.stringify(formFactor));
    const ops = activePatches.map((p: PatchItem) => p.patch);
    
    // Apply patches safely - if one fails, try to continue or just log
    // rfc6902 applyPatch modifies in place and returns results.
    applyPatch(preview, ops);
    
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

    // Phase 13: Review Mode
    isReviewMode: false,
    pendingPatches: [],
    preReviewSnapshot: null,

    setReviewMode: (mode: boolean) => set({ isReviewMode: mode }),
    
    setPendingPatches: (patches: PatchItem[]) => set({ pendingPatches: patches }),
    
    acceptPatch: (patchId: string) => {
      const { pendingPatches, formFactor, preReviewSnapshot } = get();
      const patch = pendingPatches.find((p: PatchItem) => p.id === patchId);
      if (!patch || !preReviewSnapshot) return;
      
      // Apply this single patch to preReviewSnapshot and update formFactor
      const updated = JSON.parse(JSON.stringify(preReviewSnapshot));
      applyPatch(updated, [patch.patch]);
      
      // Update pending patches status
      const newPatches = pendingPatches.map((p: PatchItem) => 
        p.id === patchId ? { ...p, status: 'accepted' as const } : p
      );
      
      // Check if all patches are processed
      const allProcessed = newPatches.every((p: PatchItem) => p.status !== 'pending');
      
      set({ 
        formFactor: updated,
        preReviewSnapshot: updated, // Update snapshot for next patch
        pendingPatches: newPatches,
        isReviewMode: !allProcessed
      });
    },
    
    rejectPatch: (patchId: string) => {
      const { pendingPatches } = get();
      
      const newPatches = pendingPatches.map((p: PatchItem) => 
        p.id === patchId ? { ...p, status: 'rejected' as const } : p
      );
      
      const allProcessed = newPatches.every((p: PatchItem) => p.status !== 'pending');
      
      set({ 
        pendingPatches: newPatches,
        isReviewMode: !allProcessed
      });
    },
    
    // Accept all patches for a specific block at once
    acceptPatchesByBlockId: (blockId: string) => {
      const { pendingPatches, preReviewSnapshot } = get();
      if (!preReviewSnapshot) return;
      
      // Get all pending patches for this block
      const blockPatches = pendingPatches.filter(
        (p: PatchItem) => p.targetBlockId === blockId && p.status === 'pending'
      );
      
      if (blockPatches.length === 0) return;
      
      // Apply all patches for this block
      const updated = JSON.parse(JSON.stringify(preReviewSnapshot));
      blockPatches.forEach((p: PatchItem) => {
        applyPatch(updated, [p.patch]);
      });
      
      // Mark all these patches as accepted
      const newPatches = pendingPatches.map((p: PatchItem) => 
        p.targetBlockId === blockId && p.status === 'pending' 
          ? { ...p, status: 'accepted' as const } 
          : p
      );
      
      const allProcessed = newPatches.every((p: PatchItem) => p.status !== 'pending');
      
      set({ 
        formFactor: updated,
        preReviewSnapshot: updated,
        pendingPatches: newPatches,
        isReviewMode: !allProcessed
      });
    },
    
    // Reject all patches for a specific block at once
    rejectPatchesByBlockId: (blockId: string) => {
      const { pendingPatches } = get();
      
      const newPatches = pendingPatches.map((p: PatchItem) => 
        p.targetBlockId === blockId && p.status === 'pending' 
          ? { ...p, status: 'rejected' as const } 
          : p
      );
      
      const allProcessed = newPatches.every((p: PatchItem) => p.status !== 'pending');
      
      set({ 
        pendingPatches: newPatches,
        isReviewMode: !allProcessed
      });
    },
    
    acceptAllPatches: () => {
      const { pendingPatches, preReviewSnapshot } = get();
      if (!preReviewSnapshot) return;
      
      // Apply all pending patches
      const pendingOps = pendingPatches
        .filter((p: PatchItem) => p.status === 'pending')
        .map((p: PatchItem) => p.patch);
      
      const updated = JSON.parse(JSON.stringify(preReviewSnapshot));
      applyPatch(updated, pendingOps);
      
      const newPatches = pendingPatches.map((p: PatchItem) => 
        p.status === 'pending' ? { ...p, status: 'accepted' as const } : p
      );
      
      set({ 
        formFactor: updated,
        pendingPatches: newPatches,
        isReviewMode: false,
        preReviewSnapshot: null
      });
    },
    
    rejectAllPatches: () => {
      set({ 
        pendingPatches: [],
        isReviewMode: false,
        preReviewSnapshot: null
      });
    },
    
    saveSnapshot: () => {
      const { formFactor } = get();
      if (formFactor) {
        set({ preReviewSnapshot: JSON.parse(JSON.stringify(formFactor)) });
      }
    },
    
    restoreSnapshot: () => {
      const { preReviewSnapshot } = get();
      if (preReviewSnapshot) {
        set({ 
          formFactor: preReviewSnapshot,
          preReviewSnapshot: null,
          pendingPatches: [],
          isReviewMode: false
        });
      }
    },
  }),
  {
    name: 'formia-storage',
    partialize: (state) => ({ 
      config: state.config,
    }),
  }
)
);
