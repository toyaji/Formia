import { create } from 'zustand';
import { FormFactor } from '@/lib/core/schema';
import { applyPatch, Operation } from 'rfc6902';

interface FormState {
  formFactor: FormFactor | null;
  setFormFactor: (factor: FormFactor) => void;
  applyJsonPatch: (patches: Operation[]) => void;
  isDraft: boolean;
  setDraft: (isDraft: boolean) => void;
}

export const useFormStore = create<FormState>((set: any, get: any) => ({
  formFactor: null,
  isDraft: false,

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
}));
