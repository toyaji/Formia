import { describe, it, expect } from 'vitest';
import { buildReviewModel } from './patchUtils';
import { FormFactor } from '@/lib/core/schema';
import { PatchItem } from '@/store/useFormStore';

describe('buildReviewModel', () => {
  const mockSnapshot: FormFactor = {
    version: '2.0.0',
    metadata: { title: 'Test Form', createdAt: '', updatedAt: '' },
    theme: { mode: 'light', tokens: { primary: '' } },
    pages: {
      start: {
        id: 'page-1',
        type: 'start',
        title: 'Page 1',
        removable: true,
        blocks: [
          { id: 'block-1', type: 'text', content: { label: 'Label 1' }, removable: true }
        ]
      },
      questions: [],
      endings: [
        {
          id: 'page-end',
          type: 'ending',
          title: 'Ending',
          removable: false,
          blocks: []
        }
      ]
    }
  };

  it('identifies added blocks using IDs', () => {
    const effective: FormFactor = JSON.parse(JSON.stringify(mockSnapshot));
    effective.pages.start.blocks.push({
      id: 'block-new',
      type: 'text',
      content: { label: 'New Block' },
      removable: true
    });

    const pendingPatches: PatchItem[] = [
      {
        id: 'patch-1',
        status: 'pending',
        changeType: 'add',
        targetBlockId: 'block-new',
        targetField: 'block',
        patch: { op: 'add', path: '/pages/start/blocks/1', value: effective.pages.start.blocks[1] }
      }
    ];

    const model = buildReviewModel(mockSnapshot, effective, pendingPatches);
    
    expect(model[0].blocks).toHaveLength(2);
    expect(model[0].blocks[1].reviewMetadata.status).toBe('added');
    expect(model[0].blocks[1].id).toBe('block-new');
  });

  it('identifies removed blocks and injects them back', () => {
    const effective: FormFactor = JSON.parse(JSON.stringify(mockSnapshot));
    effective.pages.start.blocks = [];

    const pendingPatches: PatchItem[] = [
      {
        id: 'patch-remove',
        status: 'pending',
        changeType: 'remove',
        targetBlockId: 'block-1',
        targetField: 'block',
        patch: { op: 'remove', path: '/pages/start/blocks/0' }
      }
    ];

    const model = buildReviewModel(mockSnapshot, effective, pendingPatches);
    
    expect(model[0].blocks).toHaveLength(1);
    expect(model[0].blocks[0].id).toBe('block-1');
    expect(model[0].blocks[0].reviewMetadata.status).toBe('removed');
  });

  it('identifies modified blocks with field-level patches', () => {
    const effective: FormFactor = JSON.parse(JSON.stringify(mockSnapshot));
    effective.pages.start.blocks[0].content.label = 'Updated Label';

    const pendingPatches: PatchItem[] = [
      {
        id: 'patch-mod',
        status: 'pending',
        changeType: 'replace',
        targetBlockId: 'block-1',
        targetField: 'label',
        patch: { op: 'replace', path: '/pages/start/blocks/0/content/label', value: 'Updated Label' }
      }
    ];

    const model = buildReviewModel(mockSnapshot, effective, pendingPatches);
    
    expect(model[0].blocks[0].reviewMetadata.status).toBe('modified');
    expect(model[0].blocks[0].reviewMetadata.fieldPatches?.['label']).toBeDefined();
  });

  it('handles complex shuffle (move + add + delete)', () => {
    // Snapshot: [Block A, Block B]
    const snapshot: FormFactor = {
      version: '2.0.0', // Added missing properties for FormFactor
      metadata: { title: 'Test Form', createdAt: '', updatedAt: '' }, // Added missing properties
      theme: { mode: 'light', tokens: { primary: '' } }, // Added missing properties
      pages: {
        ...mockSnapshot.pages,
        questions: [{
          ...mockSnapshot.pages.start, // reusing some props
          id: 'page-q1',
          type: 'default',
          removable: true,
          blocks: [
            { id: 'block-a', type: 'text', content: { label: 'A' }, removable: true },
            { id: 'block-b', type: 'text', content: { label: 'B' }, removable: true }
          ]
        }]
      }
    };

    const effective: FormFactor = JSON.parse(JSON.stringify(snapshot));
    const blockA = effective.pages.questions[0].blocks[0];
    effective.pages.questions[0].blocks = [
      { id: 'block-c', type: 'text', content: { label: 'C' }, removable: true },
      blockA
    ];

    const pendingPatches: PatchItem[] = [
      {
        id: 'p-add',
        status: 'pending',
        changeType: 'add',
        targetBlockId: 'block-c',
        targetField: 'block',
        patch: { op: 'add', path: '/pages/questions/0/blocks/0', value: effective.pages.questions[0].blocks[0] }
      },
      {
        id: 'p-remove',
        status: 'pending',
        changeType: 'remove',
        targetBlockId: 'block-b',
        targetField: 'block',
        patch: { op: 'remove', path: '/pages/questions/0/blocks/1' }
      }
    ];

    const model = buildReviewModel(snapshot, effective, pendingPatches);
    
    // RVM should contain Start Page at [0], and Question Page at [1]
    const questionPage = model.find(p => p.id === 'page-q1');
    expect(questionPage).toBeDefined();
    
    const blockIds = questionPage!.blocks.map(b => b.id);
    expect(blockIds).toContain('block-a');
    expect(blockIds).toContain('block-b');
    expect(blockIds).toContain('block-c');

    const bA = questionPage!.blocks.find(b => b.id === 'block-a');
    const bB = questionPage!.blocks.find(b => b.id === 'block-b');
    const bC = questionPage!.blocks.find(b => b.id === 'block-c');

    expect(bA?.reviewMetadata.status).toBe('kept');
    expect(bB?.reviewMetadata.status).toBe('removed');
    expect(bC?.reviewMetadata.status).toBe('added');
  });
});
