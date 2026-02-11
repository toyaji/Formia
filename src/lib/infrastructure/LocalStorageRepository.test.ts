import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageRepository } from './LocalStorageRepository';
import { FormFactor } from '@/lib/core/schema';

// Mock the global localStorage since JSDOM environment is having issues
const mockStorage: Record<string, string> = {};
global.localStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  }),
  length: 0,
  key: vi.fn(),
};

describe('LocalStorageRepository', () => {
  let repo: LocalStorageRepository;
  const mockForm: FormFactor = {
    version: '1.0',
    metadata: {
      title: 'Test Form',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    theme: { mode: 'light', tokens: {} },
    pages: { start: { id: 'start', type: 'start', title: 'Start', blocks: [], removable: false }, questions: [], endings: [] }
  };

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageRepository();
    vi.clearAllMocks();
  });

  it('saves and loads a form', async () => {
    await repo.save('test-id', mockForm);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'formia_draft_test-id',
      expect.stringContaining('Test Form')
    );
    
    const loaded = await repo.load('test-id');
    expect(loaded.metadata.title).toBe('Test Form');
  });

  it('lists saved forms in reverse chronological order', async () => {
    const form1 = { ...mockForm, metadata: { ...mockForm.metadata, title: 'Form 1', updatedAt: '2026-01-01T00:00:00Z' } };
    const form2 = { ...mockForm, metadata: { ...mockForm.metadata, title: 'Form 2', updatedAt: '2026-01-02T00:00:00Z' } };

    await repo.save('id1', form1);
    await repo.save('id2', form2);

    const list = await repo.list();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('id2'); // id2 (Jan 2) comes before id1 (Jan 1)
  });

  it('deletes a form', async () => {
    await repo.save('id1', mockForm);
    await repo.delete('id1');
    const list = await repo.list();
    expect(list).toHaveLength(0);
    expect(localStorage.removeItem).toHaveBeenCalledWith('formia_draft_id1');
  });
});
