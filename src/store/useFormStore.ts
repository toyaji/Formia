import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FormFactor } from '@/lib/core/schema';
import { applyPatch, Operation } from 'rfc6902';
import { buildReviewModel, ReviewFormPage, sortPages } from '@/lib/utils/patchUtils';
import { CloudAPIRepository } from '@/lib/infrastructure/CloudAPIRepository';
import { TauriFileRepository } from '@/lib/infrastructure/TauriFileRepository';
import { LocalStorageRepository } from '@/lib/infrastructure/LocalStorageRepository';
import { FormInfo, FormRepository } from '@/lib/core/repository';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system_error' | 'system_info';
  content: string;
  timestamp: string;
}

interface AppConfig {
  // Config no longer stores secrets
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
  getReviewViewModel: () => ReviewFormPage[];
  
  // History
  history: FormFactor[];
  future: FormFactor[];
  undo: () => void;
  redo: () => void;
  recordAction: () => void;
  
  // Settings
  config: AppConfig;
  setConfig: (config: Partial<AppConfig>) => void;
  aiKeyStatus: Record<string, { active: boolean; masked: string }>;
  setAiKeyStatus: (provider: string, status: { active: boolean; masked: string }) => void;
  
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
  resolvePagePatch: (patchId: string, action: 'accept' | 'reject') => void;
  acceptPatchesByBlockId: (blockId: string) => void;
  rejectPatchesByBlockId: (blockId: string) => void;
  acceptAllPatches: () => void;
  rejectAllPatches: () => void;
  preReviewSnapshot: FormFactor | null;
  saveSnapshot: () => void;
  restoreSnapshot: () => void;
  
  // Persistence State
  session: any;
  setSession: (session: any) => void;
  formId: string | null;
  setFormId: (id: string | null) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  syncWithPersistence: (session?: any) => Promise<void>;
  
  // Dashboard & Initialization
  formsList: FormInfo[];
  isLoadingForms: boolean;
  loadAllForms: () => Promise<void>;
  initApp: (session?: any) => Promise<void>;
  exportCurrentForm: () => Promise<void>;
}

const isTauri = typeof window !== 'undefined' && ((window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined);

function getRepository(session: any): FormRepository {
  if (session?.user?.id) {
    return new CloudAPIRepository();
  }
  if (isTauri) {
    return new TauriFileRepository();
  }
  return new LocalStorageRepository();
}

export const useFormStore = create<FormState>()(
  persist(
    (set: any, get: any): FormState => ({
      formFactor: null as FormFactor | null,
      activePageId: null as string | null,
      activeBlockId: null as string | null,
      isDraft: false,
      messages: [],

      setActivePageId: (id: string | null) => set({ activePageId: id, activeBlockId: null }),
      setActiveBlockId: (id: string | null) => set({ activeBlockId: id }),
      setFormFactor: (factor: FormFactor) => {
        set({ formFactor: factor });
        if (!get().activePageId) {
          if (factor.pages.start) {
            set({ activePageId: factor.pages.start.id });
          } else if (factor.pages.questions.length > 0) {
            set({ activePageId: factor.pages.questions[0].id });
          } else if (factor.pages.endings.length > 0) {
            set({ activePageId: factor.pages.endings[0].id });
          }
        }
      },

      formId: null,
      setFormId: (id: string | null) => set({ formId: id }),
      saveStatus: 'idle',
      session: null,
      setSession: (session: any) => set({ session }),
      formsList: [],
      isLoadingForms: false,

      initApp: async (initSession: any) => {
        const currentSession = initSession || get().session;
        const repo = getRepository(currentSession);
        const { formId, formFactor } = get();

        // If we already have a formId and factor, we are good
        if (formId && formFactor) return;

        try {
          let targetId = formId;

          if (!targetId) {
            const list = await repo.list();
            if (list.length > 0) {
              targetId = list[0].id;
            }
          }

          if (targetId) {
            const factor = await repo.load(targetId);
            set({ formFactor: factor, formId: targetId });
          }
        } catch (e) {
          console.error('[initApp] Failed to load initial form:', e);
        }
      },

      loadAllForms: async () => {
        set({ isLoadingForms: true });
        const { session } = get();
        try {
          const repo = getRepository(session);
          const forms = await repo.list();
          set({ formsList: forms });
        } catch (e) {
          console.error('Failed to load forms list:', e);
        } finally {
          set({ isLoadingForms: false });
        }
      },

      syncWithPersistence: async (customSession?: any) => {
        const { formFactor, formId, session } = get();
        const effectiveSession = customSession || session;
        if (!formFactor || !formId) return;
        
        set({ saveStatus: 'saving' });
        try {
          const repo = getRepository(effectiveSession);
          await repo.save(formId, formFactor);
          set({ saveStatus: 'saved' });
          setTimeout(() => {
            if (get().saveStatus === 'saved') set({ saveStatus: 'idle' });
          }, 3000);
        } catch (error) {
          console.error('Persistence sync failed:', error);
          set({ saveStatus: 'error' });
        }
      },

      exportCurrentForm: async () => {
        const { formFactor, formId } = get();
        if (!formFactor) return;
        const data = JSON.stringify(formFactor, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${formId || 'form'}.formia`;
        a.click();
        URL.revokeObjectURL(url);
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
      
      // Auto-save logic
      const timeoutId = (window as any)._formiaSaveTimeout;
      if (timeoutId) clearTimeout(timeoutId);
      
      (window as any)._formiaSaveTimeout = setTimeout(() => {
        get().syncWithPersistence();
      }, 1000); // 1s debounce
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

  getReviewViewModel: () => {
    const { preReviewSnapshot, pendingPatches } = get();
    const effective = get().getEffectiveFactor();
    return buildReviewModel(preReviewSnapshot, effective, pendingPatches);
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
    config: {},
    setConfig: (newConfig: Partial<AppConfig>) => set((state: FormState) => ({
      config: { ...state.config, ...newConfig }
    })),
    aiKeyStatus: {},
    setAiKeyStatus: (provider: string, status: { active: boolean; masked: string }) => 
      set((state: FormState) => ({
        aiKeyStatus: { ...state.aiKeyStatus, [provider]: status }
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
    
    // Resolve a page-level patch (accept/reject) and all its child patches (e.g. blocks inside)
    resolvePagePatch: (patchId: string, action: 'accept' | 'reject') => {
      const { pendingPatches, preReviewSnapshot } = get();
      const mainPatch = pendingPatches.find((p: PatchItem) => p.id === patchId);
      
      if (!mainPatch || !preReviewSnapshot) return;

      // Identify child patches: any patch where path starts with the page path
      // e.g. main path: /pages/0 -> child path: /pages/0/blocks/1
      const mainPath = mainPatch.patch.path;
      const childPatches = pendingPatches.filter((p: PatchItem) => 
        p.id !== patchId && 
        p.status === 'pending' && 
        p.patch.path.startsWith(mainPath + '/')
      );
      
      const allTargetPatches = [mainPatch, ...childPatches];
      
      // Update statuses
      const newStatus = action === 'accept' ? 'accepted' : 'rejected';
      const targetIds = new Set(allTargetPatches.map(p => p.id));
      
      const newPendingPatches = pendingPatches.map((p: PatchItem) => 
        targetIds.has(p.id) ? { ...p, status: newStatus } : p
      );

      // If accepting, apply changes to snapshot
      let updatedSnapshot = preReviewSnapshot;
      if (action === 'accept') {
        updatedSnapshot = JSON.parse(JSON.stringify(preReviewSnapshot));
        
        // Strategy:
        // - If main op is 'remove', only apply main patch. (Children are gone with parent).
        // - If main op is 'add' or 'replace', apply main + children.
        const opsToApply = [];
        if (mainPatch.patch.op === 'remove') {
          opsToApply.push(mainPatch.patch);
        } else {
          // Sort patches might be needed if children depend on order?
          // Usually pendingPatches are in order.
          // We filter them from pendingPatches list which preserves order.
          opsToApply.push(mainPatch.patch, ...childPatches.map((p: PatchItem) => p.patch));
        }
        
        // check for errors when applying
        applyPatch(updatedSnapshot, opsToApply);
      }

      const allProcessed = newPendingPatches.every((p: PatchItem) => p.status !== 'pending'); 
      
      set({
        formFactor: action === 'accept' ? updatedSnapshot : get().formFactor, // Only update effective formFactor if accepted (actually formFactor should match snapshot if accepted)
        // Wait, normally formFactor tracks snapshot in review mode?
        // Yes, acceptPatch updates formFactor AND preReviewSnapshot.
        preReviewSnapshot: updatedSnapshot,
        pendingPatches: newPendingPatches,
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
      aiKeyStatus: state.aiKeyStatus,
      formId: state.formId, // Persist last edited form ID
    }),
  }
)
);
