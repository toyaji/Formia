import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from './GeminiProvider';
import { FormFactor } from '../core/schema';

// Mock global fetch
global.fetch = vi.fn();

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  const mockSchema: FormFactor = {
    version: "2.0.0",
    metadata: {
      title: "Test Form",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    theme: {
      mode: 'light',
      tokens: {}
    },
    pages: [{ id: 'page-1', type: 'default', title: 'Start', removable: true, blocks: [] }]
  };

  beforeEach(() => {
    provider = new GeminiProvider();
    vi.clearAllMocks();
  });

  it('should call AI Proxy with correct URL and body', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        patches: [{ op: 'add', path: '/pages/0/blocks/-', value: { id: '1', type: 'text', content: { label: 'New' }, removable: true } }],
        summary: 'Added a text field'
      })
    });

    const patches = await provider.generatePatch('Add a text field', mockSchema);

    expect(fetch).toHaveBeenCalledWith(
      '/api/ai/generate',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Add a text field')
      })
    );
    expect(patches).toHaveLength(1);
    expect(patches[0].op).toBe('add');
  });

  it('should throw error on API failure', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Invalid API Key'
      })
    });

    await expect(provider.generatePatch('test', mockSchema)).rejects.toThrow('Invalid API Key');
  });
});
