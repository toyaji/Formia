import { describe, it, expect } from 'vitest';
import { validatePatches } from './patchValidator';
import { FormFactor } from '../core/schema';

describe('PatchValidator', () => {
  const mockSchema: FormFactor = {
    version: '2.0.0',
    metadata: {
      title: 'Test Form',
      createdAt: '',
      updatedAt: '',
    },
    theme: { mode: 'light', tokens: {} },
    pages: {
      start: {
        id: 'page-1',
        type: 'start',
        title: 'Start',
        removable: false, // Non-removable page
        blocks: [
          {
            id: 'block-1',
            type: 'statement',
            removable: false, // Non-removable block
            content: { label: 'Hello' }
          },
          {
            id: 'block-2',
            type: 'text',
            removable: true, // Removable block
            content: { label: 'Name' }
          }
        ]
      },
      questions: [
        {
          id: 'page-2',
          type: 'default',
          title: 'Middle',
          removable: true,
          blocks: []
        }
      ],
      endings: [
        {
          id: 'page-3',
          type: 'ending',
          title: 'End',
          removable: false,
          blocks: []
        }
      ]
    }
  };

  it('should allow non-remove operations', () => {
    const patches: any[] = [
      { op: 'replace', path: '/pages/start/blocks/0/content/label', value: 'New Label' },
      { op: 'add', path: '/pages/start/blocks/-', value: { id: '3', type: 'text', content: { label: 'Test' } } }
    ];
    const validated = validatePatches(patches, mockSchema);
    expect(validated).toHaveLength(2);
  });

  it('should allow removal of removable blocks', () => {
    const patches: any[] = [
      { op: 'remove', path: '/pages/start/blocks/1' } // block-2 is removable
    ];
    const validated = validatePatches(patches, mockSchema);
    expect(validated).toHaveLength(1);
    expect(validated[0].op).toBe('remove');
  });

  it('should reject removal of non-removable blocks', () => {
    const patches: any[] = [
      { op: 'remove', path: '/pages/start/blocks/0' } // block-1 is NOT removable
    ];
    const validated = validatePatches(patches, mockSchema);
    expect(validated).toHaveLength(0);
  });

  it('should reject removal of non-removable pages', () => {
    const patches: any[] = [
      { op: 'remove', path: '/pages/start' } // page-1 is NOT removable
    ];
    const validated = validatePatches(patches, mockSchema);
    expect(validated).toHaveLength(0);
  });

  it('should allow removal of removable pages', () => {
    const patches: any[] = [
      { op: 'remove', path: '/pages/questions/0' } // page-2 is removable
    ];
    const validated = validatePatches(patches, mockSchema);
    expect(validated).toHaveLength(1);
  });

  it('should reject addition of blocks with invalid types', () => {
    const patches: any[] = [
      { 
        op: 'add', 
        path: '/pages/start/blocks/-', 
        value: { id: 'invalid-id', type: 'shortText', content: { label: 'Invalid' } } 
      }
    ];
    const validated = validatePatches(patches, mockSchema);
    expect(validated).toHaveLength(0);
  });

  it('should allow addition of blocks with valid types', () => {
    const patches: any[] = [
      { 
        op: 'add', 
        path: '/pages/start/blocks/-', 
        value: { id: 'valid-id', type: 'text', content: { label: 'Valid' } } 
      }
    ];
    const validated = validatePatches(patches, mockSchema);
    expect(validated).toHaveLength(1);
    expect(validated[0].op).toBe('add');
  });
});
