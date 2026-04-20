import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FormFactor } from '@/lib/core/schema';
import { applyPatch, Operation } from 'rfc6902';
import { buildReviewModel, ReviewFormPage } from '@/lib/utils/patchUtils';
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
  activeAiProvider?: string;
}

// Phase 13: Patch item for inline diff review
export interface PatchItem {
  id: string;
  patch: Operation;
  status: 'pending' | 'accepted' | 'rejected';
  targetBlockId?: string;
  changeType: 'add' | 'remove' | 'replace';
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
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Promise<void>;
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
  
  // Chat Sessions
  currentSessionId: string | null;
  chatSessions: any[];
  isLoadingSessions: boolean;
  loadChatSessions: (formId: string) => Promise<void>;
  startNewChat: () => Promise<void>;
  switchChatSession: (sessionId: string) => Promise<void>;
  deleteChatSession: (sessionId: string) => Promise<void>;
  
  // Persistence State
  session: any;
  setSession: (session: any) => void;
  formId: string | null;
  setFormId: (id: string | null) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSyncedAt: string | null;
  syncWithPersistence: (session?: any) => Promise<void>;
  
  // Dashboard & Initialization
  formsList: FormInfo[];
  isLoadingForms: boolean;
  loadAllForms: () => Promise<void>;
  initApp: (session?: any) => Promise<void>;
  exportCurrentForm: () => Promise<void>;
  exportFormById: (id: string) => Promise<void>;
  importForm: (factor: FormFactor) => Promise<void>;
  deleteForm: (id: string) => Promise<void>;
  loadFormById: (id: string) => Promise<void>;
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
      formFactor: null,
      activePageId: null,
      activeBlockId: null,
      isDraft: false,
      messages: [],
      currentSessionId: null,
      chatSessions: [],
      isLoadingSessions: false,
      saveStatus: 'idle',
      lastSyncedAt: null,
      session: null,
      formsList: [],
      isLoadingForms: false,
      formId: null,
      proposedPatches: null,
      history: [],
      future: [],
      config: {},
      aiKeyStatus: {},
      viewport: 'desktop',
      isReviewMode: false,
      pendingPatches: [],
      preReviewSnapshot: null,

      setSession: (session: any) => set({ session }),
      
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

      setFormId: (id: string | null) => {
        const currentId = get().formId;
        if (id !== currentId) {
          set({ formId: id, formFactor: null, saveStatus: 'idle', lastSyncedAt: null });
        }
      },

      initApp: async (initSession: any) => {
        const currentSession = initSession || get().session;
        const repo = getRepository(currentSession);
        const { formId, formFactor } = get();
        
        // If we already have a form, just sync sessions and return
        if (formId && formFactor) {
          if (currentSession?.user?.id) {
            get().loadChatSessions(formId);
          }
          return;
        }

        try {
          let targetId = formId;
          if (!targetId) {
            const list = await repo.list();
            if (list.length > 0) targetId = list[0].id;
          }
          if (targetId) await get().loadFormById(targetId);
        } catch (e) {
          console.error('[initApp] Failed to load initial form:', e);
        }
      },

      loadFormById: async (id: string) => {
        if (!id || id === 'draft' || id === 'new') return;
        const { session } = get();
        const repo = getRepository(session);
        const { formId: currentFormId, messages: currentMessages, currentSessionId: currentSid } = get();
        try {
          const factor = await repo.load(id);
          
          const isSameForm = currentFormId === id;
          
          set({ 
            formFactor: factor, 
            formId: id,
            saveStatus: 'saved',
            lastSyncedAt: factor.metadata.updatedAt || new Date().toISOString(),
            // Only reset if it's a different form
            currentSessionId: isSameForm ? currentSid : null,
            messages: isSameForm ? currentMessages : []
          });
          if (session?.user?.id) get().loadChatSessions(id);
        } catch (e) {
          console.error(`[loadFormById] Failed to load form ${id}:`, e);
          throw e;
        }
      },

      loadChatSessions: async (formId: string) => {
        set({ isLoadingSessions: true });
        try {
          const res = await fetch(`/api/forms/${formId}/chat-sessions`);
          if (res.ok) set({ chatSessions: await res.json() });
        } catch (error) {
          console.error('Failed to load chat sessions:', error);
        } finally {
          set({ isLoadingSessions: false });
        }
      },

      startNewChat: async () => {
        set({ currentSessionId: null, messages: [] });
      },

      switchChatSession: async (sessionId: string) => {
        set({ isLoadingSessions: true });
        try {
          const res = await fetch(`/api/chat-sessions/${sessionId}`);
          if (res.ok) {
            const data = await res.json();
            set({ 
              currentSessionId: sessionId,
              messages: data.messages.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: m.createdAt
              }))
            });
          }
        } catch (error) {
          console.error('Failed to switch chat session:', error);
        } finally {
          set({ isLoadingSessions: false });
        }
      },

      deleteChatSession: async (sessionId: string) => {
        if (!confirm('대화 기록을 삭제하시겠습니까?')) return;
        try {
          const res = await fetch(`/api/chat-sessions/${sessionId}`, { method: 'DELETE' });
          if (res.ok) {
            const { chatSessions, currentSessionId } = get();
            const newSessions = chatSessions.filter((s: any) => s.id !== sessionId);
            set({ chatSessions: newSessions });
            if (currentSessionId === sessionId) set({ currentSessionId: null, messages: [] });
          }
        } catch (error) {
          console.error('Failed to delete chat session:', error);
        }
      },

      loadAllForms: async () => {
        set({ isLoadingForms: true });
        const { session } = get();
        try {
          const repo = getRepository(session);
          set({ formsList: await repo.list() });
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
          set({ saveStatus: 'saved', lastSyncedAt: new Date().toISOString() });
        } catch (error) {
          console.error('Persistence sync failed:', error);
          set({ saveStatus: 'error' });
        }
      },

      exportCurrentForm: async () => {
        const { formFactor } = get();
        if (!formFactor) return;
        const data = JSON.stringify(formFactor, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const title = formFactor.metadata.title.replace(/\s+/g, '_') || 'form';
        a.download = `${title}.formia`;
        a.click();
        URL.revokeObjectURL(url);
      },

      exportFormById: async (id: string) => {
        const { session } = get();
        try {
          const repo = getRepository(session);
          const factor = await repo.load(id);
          const data = JSON.stringify(factor, null, 2);
          const blob = new Blob([data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const title = factor.metadata.title.replace(/\s+/g, '_') || id;
          a.download = `${title}.formia`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error('Failed to export form:', e);
          alert('파일을 내보내는데 실패했습니다.');
        }
      },

      importForm: async (factor: FormFactor) => {
        const { session, loadAllForms } = get();
        try {
          const repo = getRepository(session);
          const newId = `form_${Math.random().toString(36).substring(2, 11)}`;
          const importedFactor = {
            ...factor,
            metadata: {
              ...factor.metadata,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          };
          await repo.save(newId, importedFactor);
          await loadAllForms();
        } catch (e) {
          console.error('Failed to import form:', e);
          alert('파일을 가져오는데 실패했습니다.');
        }
      },

      deleteForm: async (id: string) => {
        const { session, loadAllForms } = get();
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
          const repo = getRepository(session);
          await repo.delete(id);
          await loadAllForms();
        } catch (e) {
          console.error('Failed to delete form:', e);
          alert('삭제에 실패했습니다.');
        }
      },

      applyJsonPatch: (patches: Operation[]) => {
        get().recordAction();
        const current = get().formFactor;
        if (!current) return;
        
        const { validatePatches } = require('@/lib/utils/patchValidator');
        const validPatches = validatePatches(patches, current);
        
        if (validPatches.length === 0 && patches.length > 0) {
          console.warn('[useFormStore] All patches were rejected by validator');
          return;
        }

        const next = JSON.parse(JSON.stringify(current));
        const results = applyPatch(next, validPatches);
        if (results.every((r: any) => r === null)) {
          set({ formFactor: next });
          const timeoutId = (window as any)._formiaSaveTimeout;
          if (timeoutId) clearTimeout(timeoutId);
          (window as any)._formiaSaveTimeout = setTimeout(() => {
            get().syncWithPersistence();
          }, 1000);
        } else {
          console.error('Failed to apply some patches:', results);
        }
      },

      setDraft: (isDraft: boolean) => set({ isDraft }),

      addMessage: async (message: Omit<Message, 'id' | 'timestamp'>) => {
        const { currentSessionId, formId, session } = get();
        const newMessage: Message = {
          ...message,
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toISOString(),
        };
        set((state: FormState) => ({
          messages: [...state.messages, newMessage],
        }));
        if (session?.user?.id && formId) {
          try {
            let sessionId = currentSessionId;
            if (!sessionId) {
              const res = await fetch(`/api/forms/${formId}/chat-sessions`, {
                method: 'POST',
                body: JSON.stringify({ title: message.content.substring(0, 30) }),
              });
              if (res.ok) {
                const newSession = await res.json();
                sessionId = newSession.id;
                set({ currentSessionId: sessionId });
                get().loadChatSessions(formId);
              }
            }
            if (sessionId) {
              await fetch(`/api/chat-sessions/${sessionId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ role: message.role, content: message.content }),
              });
              if (!currentSessionId) get().loadChatSessions(formId);
            }
          } catch (error) {
            console.error('Failed to persist message:', error);
          }
        }
      },

      clearMessages: () => set({ messages: [], currentSessionId: null }),

      setProposedPatches: (patches: Operation[] | null) => set({ proposedPatches: patches }),

      getEffectiveFactor: () => {
        const { formFactor, pendingPatches } = get();
        if (!formFactor) return null;
        const activePatches = pendingPatches.filter((p: PatchItem) => p.status === 'pending');
        if (activePatches.length === 0) return formFactor;
        const preview = JSON.parse(JSON.stringify(formFactor));
        applyPatch(preview, activePatches.map((p: PatchItem) => p.patch));
        return preview;
      },

      getReviewViewModel: () => {
        const { preReviewSnapshot, pendingPatches } = get();
        const effective = get().getEffectiveFactor();
        return buildReviewModel(preReviewSnapshot, effective, pendingPatches);
      },

      recordAction: () => {
        const { formFactor, history } = get();
        if (!formFactor) return;
        const nextHistory = [JSON.parse(JSON.stringify(formFactor)), ...history].slice(0, 50);
        set({ history: nextHistory, future: [] });
      },

      undo: () => {
        const { history, future, formFactor } = get();
        if (history.length === 0 || !formFactor) return;
        const previous = history[0];
        set({
          formFactor: previous,
          history: history.slice(1),
          future: [JSON.parse(JSON.stringify(formFactor)), ...future]
        });
      },

      redo: () => {
        const { history, future, formFactor } = get();
        if (future.length === 0 || !formFactor) return;
        set({
          formFactor: future[0],
          history: [JSON.parse(JSON.stringify(formFactor)), ...history],
          future: future.slice(1)
        });
      },

      setConfig: (newConfig: Partial<AppConfig>) => set((state: FormState) => ({
        config: { ...state.config, ...newConfig }
      })),

      setAiKeyStatus: (provider: string, status: { active: boolean; masked: string }) => 
        set((state: FormState) => ({
          aiKeyStatus: { ...state.aiKeyStatus, [provider]: status }
        })),

      setViewport: (viewport: 'desktop' | 'mobile') => set({ viewport }),

      setReviewMode: (mode: boolean) => set({ isReviewMode: mode }),
      
      setPendingPatches: (patches: PatchItem[]) => set({ pendingPatches: patches }),
      
      acceptPatch: (patchId: string) => {
        const { pendingPatches, preReviewSnapshot } = get();
        const patch = pendingPatches.find((p: PatchItem) => p.id === patchId);
        if (!patch || !preReviewSnapshot) return;
        const updated = JSON.parse(JSON.stringify(preReviewSnapshot));
        applyPatch(updated, [patch.patch]);
        const newPatches = pendingPatches.map((p: PatchItem) => 
          p.id === patchId ? { ...p, status: 'accepted' as const } : p
        );
        const allProcessed = newPatches.every((p: PatchItem) => p.status !== 'pending');
        set({ 
          formFactor: updated,
          preReviewSnapshot: updated,
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
        set({ pendingPatches: newPatches, isReviewMode: !allProcessed });
      },
      
      resolvePagePatch: (patchId: string, action: 'accept' | 'reject') => {
        const { pendingPatches, preReviewSnapshot } = get();
        const mainPatch = pendingPatches.find((p: PatchItem) => p.id === patchId);
        if (!mainPatch || !preReviewSnapshot) return;
        const mainPath = mainPatch.patch.path;
        const childPatches = pendingPatches.filter((p: PatchItem) => 
          p.id !== patchId && p.status === 'pending' && p.patch.path.startsWith(mainPath + '/')
        );
        const newStatus = action === 'accept' ? 'accepted' : 'rejected';
        const targetIds = new Set([patchId, ...childPatches.map((p: PatchItem) => p.id)]);
        const newPendingPatches = pendingPatches.map((p: PatchItem) => 
          targetIds.has(p.id) ? { ...p, status: newStatus } : p
        );
        let updatedSnapshot = preReviewSnapshot;
        if (action === 'accept') {
          updatedSnapshot = JSON.parse(JSON.stringify(preReviewSnapshot));
          applyPatch(updatedSnapshot, [mainPatch.patch, ...childPatches.map((p: PatchItem) => p.patch)]);
        }
        const allProcessed = newPendingPatches.every((p: PatchItem) => p.status !== 'pending'); 
        set({
          formFactor: action === 'accept' ? updatedSnapshot : get().formFactor,
          preReviewSnapshot: updatedSnapshot,
          pendingPatches: newPendingPatches,
          isReviewMode: !allProcessed
        });
      },
      
      acceptPatchesByBlockId: (blockId: string) => {
        const { pendingPatches, preReviewSnapshot } = get();
        if (!preReviewSnapshot) return;
        const blockPatches = pendingPatches.filter((p: PatchItem) => p.targetBlockId === blockId && p.status === 'pending');
        if (blockPatches.length === 0) return;
        const updated = JSON.parse(JSON.stringify(preReviewSnapshot));
        blockPatches.forEach((p: PatchItem) => applyPatch(updated, [p.patch]));
        const newPatches = pendingPatches.map((p: PatchItem) => 
          p.targetBlockId === blockId && p.status === 'pending' ? { ...p, status: 'accepted' as const } : p
        );
        const allProcessed = newPatches.every((p: PatchItem) => p.status !== 'pending');
        set({ 
          formFactor: updated,
          preReviewSnapshot: updated,
          pendingPatches: newPatches,
          isReviewMode: !allProcessed
        });
      },
      
      rejectPatchesByBlockId: (blockId: string) => {
        const { pendingPatches } = get();
        const newPatches = pendingPatches.map((p: PatchItem) => 
          p.targetBlockId === blockId && p.status === 'pending' ? { ...p, status: 'rejected' as const } : p
        );
        const allProcessed = newPatches.every((p: PatchItem) => p.status !== 'pending');
        set({ pendingPatches: newPatches, isReviewMode: !allProcessed });
      },
      
      acceptAllPatches: () => {
        const { pendingPatches, preReviewSnapshot } = get();
        if (!preReviewSnapshot) return;
        const pendingOps = pendingPatches.filter((p: PatchItem) => p.status === 'pending').map((p: PatchItem) => p.patch);
        const updated = JSON.parse(JSON.stringify(preReviewSnapshot));
        applyPatch(updated, pendingOps);
        set({ 
          formFactor: updated,
          pendingPatches: pendingPatches.map((p: PatchItem) => p.status === 'pending' ? { ...p, status: 'accepted' as const } : p),
          isReviewMode: false,
          preReviewSnapshot: null
        });
      },
      
      rejectAllPatches: () => set({ pendingPatches: [], isReviewMode: false, preReviewSnapshot: null }),
      
      saveSnapshot: () => {
        const { formFactor } = get();
        if (formFactor) set({ preReviewSnapshot: JSON.parse(JSON.stringify(formFactor)) });
      },
      
      restoreSnapshot: () => {
        const { preReviewSnapshot } = get();
        if (preReviewSnapshot) {
          set({ formFactor: preReviewSnapshot, preReviewSnapshot: null, pendingPatches: [], isReviewMode: false });
        }
      },
    }),
    {
      name: 'formia-storage',
      partialize: (state) => ({ 
        config: state.config,
        aiKeyStatus: state.aiKeyStatus,
        formId: state.formId,
        formFactor: state.formFactor,
        messages: state.messages,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
);
