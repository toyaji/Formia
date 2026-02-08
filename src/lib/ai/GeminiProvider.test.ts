import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from './GeminiProvider';
import { FormFactor } from '../core/schema';

// Mock global fetch
global.fetch = vi.fn();

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  const mockApiKey = 'test-api-key';
  const mockSchema: FormFactor = {
    version: "1.0",
    metadata: {
      title: "Test Form",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    theme: {
      mode: 'light',
      tokens: {}
    },
    blocks: []
  };

  beforeEach(() => {
    provider = new GeminiProvider(mockApiKey);
    vi.clearAllMocks();
  });

  it('should throw error if API key is missing', async () => {
    const noKeyProvider = new GeminiProvider('');
    await expect(noKeyProvider.generatePatch('test', mockSchema)).rejects.toThrow('Gemini API Key is missing');
  });

  it('should call Gemini API with correct URL and body', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify([{ op: 'add', path: '/blocks/-', value: { id: '1', type: 'text', content: { label: 'New' } } }])
            }]
          }
        }]
      })
    });

    const patches = await provider.generatePatch('Add a text field', mockSchema);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-2.5-flash'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Add a text field')
      })
    );
    expect(patches).toHaveLength(1);
    expect(patches[0].op).toBe('add');
  });

  it('should handle markdown wrapped JSON response', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '```json\n[{"op": "remove", "path": "/blocks/0"}]\n```'
            }]
          }
        }]
      })
    });

    const patches = await provider.generatePatch('Delete first block', mockSchema);
    expect(patches).toHaveLength(1);
    expect(patches[0].op).toBe('remove');
  });

  it('should throw error on API failure', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: 'Invalild API Key' }
      })
    });

    await expect(provider.generatePatch('test', mockSchema)).rejects.toThrow('Invalild API Key');
  });
});
