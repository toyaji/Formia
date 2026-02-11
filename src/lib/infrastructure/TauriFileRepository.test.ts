import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TauriFileRepository } from './TauriFileRepository';
import { FormFactor } from '@/lib/core/schema';

// Mock Tauri modules
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  documentDir: vi.fn().mockResolvedValue('/mock/documents'),
  join: vi.fn().mockImplementation((...args) => Promise.resolve(args.join('/'))),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { Document: 0 },
  exists: vi.fn().mockResolvedValue(true),
  mkdir: vi.fn(),
  writeTextFile: vi.fn(),
  readTextFile: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
}));

import { exists, writeTextFile, readTextFile, readDir } from '@tauri-apps/plugin-fs';

describe('TauriFileRepository', () => {
  let repo: TauriFileRepository;
  const mockForm: FormFactor = {
    version: '1.0',
    metadata: {
      title: 'Tauri Form',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    theme: { mode: 'light', tokens: {} },
    pages: { start: { id: 'start', type: 'start', title: 'Start', blocks: [], removable: false }, questions: [], endings: [] }
  };

  beforeEach(() => {
    repo = new TauriFileRepository();
    vi.clearAllMocks();
  });

  it('saves a form correctly', async () => {
    await repo.save('test-id', mockForm);
    expect(writeTextFile).toHaveBeenCalledWith(
      'Formia/test-id.formia',
      expect.stringContaining('"title": "Tauri Form"'),
      expect.objectContaining({ baseDir: 0 })
    );
  });

  it('loads a form correctly', async () => {
    vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(mockForm));
    const loaded = await repo.load('test-id');
    expect(loaded.metadata.title).toBe('Tauri Form');
    expect(readTextFile).toHaveBeenCalledWith(
      'Formia/test-id.formia',
      expect.objectContaining({ baseDir: 0 })
    );
  });

  it('lists forms and sorts them by date', async () => {
    vi.mocked(readDir).mockResolvedValue([
      { name: 'form1.formia', isFile: true, isDirectory: false },
      { name: 'form2.formia', isFile: true, isDirectory: false },
      { name: 'other.txt', isFile: true, isDirectory: false },
    ] as any);

    vi.mocked(readTextFile).mockImplementation(async (path) => {
      if (path === 'Formia/form1.formia') {
        return JSON.stringify({ ...mockForm, metadata: { ...mockForm.metadata, title: 'Form 1', updatedAt: '2026-01-01T00:00:00Z' } });
      }
      if (path === 'Formia/form2.formia') {
        return JSON.stringify({ ...mockForm, metadata: { ...mockForm.metadata, title: 'Form 2', updatedAt: '2026-01-02T00:00:00Z' } });
      }
      return '';
    });

    const list = await repo.list();
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe('Form 2'); // Most recent first
    expect(list[1].title).toBe('Form 1');
  });

  it('imports external files', async () => {
    const externalPath = '/some/path/my.formia';
    vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(mockForm));
    
    const newId = await repo.importExternalFile(externalPath);
    expect(newId).toContain('tauri_form_');
    expect(writeTextFile).toHaveBeenCalled();
  });
});
