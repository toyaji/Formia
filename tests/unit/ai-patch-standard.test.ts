import { describe, it, expect } from 'vitest';
import { validatePatchesDetailed } from '../../src/lib/utils/patchValidator';
import { FormFactorSchema, FormFactor } from '../../src/lib/core/schema';
import { applyPatch, Operation } from 'rfc6902';
import { getDefaultForm } from '../../src/lib/constants/defaultForm';

/**
 * AI Patch Generation Standard Test Suite
 * This suite verifies that AI-generated patches (mocked or real) 
 * strictly adhere to the Form Factor v2 standard.
 */
describe('AI Patch Generation - Structural Alignment', () => {
  const initialForm = getDefaultForm();

  const validateResultingSchema = (form: any) => {
    return FormFactorSchema.parse(form);
  };

  it('Scenario 1: Simple Addition - Basic Text Block', () => {
    const patches: Operation[] = [
      {
        op: 'add',
        path: '/pages/start/blocks/-',
        value: {
          id: 'test-block-1',
          type: 'text',
          content: {
            label: '성함을 입력해주세요',
            placeholder: '예: 홍길동'
          },
          validation: { required: true },
          removable: true
        }
      }
    ];

    // 1. Validate Patch Syntax
    const result = validatePatchesDetailed(patches, initialForm);
    expect(result.isValid, `Validation errors: ${result.errors.join(', ')}`).toBe(true);

    // 2. Apply Patch
    const newForm = JSON.parse(JSON.stringify(initialForm));
    const patchResults = applyPatch(newForm, patches);
    expect(patchResults.every(r => r === null)).toBe(true);

    // 3. Validate Resulting Schema
    expect(() => validateResultingSchema(newForm)).not.toThrow();
    // In start page, blocks[3] because it already had 3 blocks
    expect(newForm.pages.start.blocks[3].content.label).toBe('성함을 입력해주세요');
  });

  it('Scenario 2: Choice Block - Must have options', () => {
    const patches: Operation[] = [
      {
        op: 'add',
        path: '/pages/start/blocks/-',
        value: {
          id: 'test-choice-1',
          type: 'choice',
          content: {
            label: '가장 좋아하는 색상은?',
            options: ['빨강', '파랑', '초록']
          }
        }
      }
    ];

    const { isValid } = validatePatchesDetailed(patches, initialForm);
    expect(isValid).toBe(true);
    // ... rest remains same but I'll update path for badPatches too
    const badPatches: Operation[] = [
      {
        op: 'add',
        path: '/pages/start/blocks/-',
        value: {
          id: 'bad-choice',
          type: 'choice',
          content: { label: '옵션 없는 객관식' }
        }
      }
    ];

    const { isValid: isBadValid, errors } = validatePatchesDetailed(badPatches, initialForm);
    expect(isBadValid).toBe(false);
  });

  it('Scenario 3: Abstract Request - "Add a feedback page with rating"', () => {
    const patches: Operation[] = [
      // 1. Add new page
      {
        op: 'add',
        path: '/pages/questions/-',
        value: {
          id: 'page-feedback',
          type: 'default',
          title: '피드백 페이지',
          blocks: []
        }
      },
      // 2. Add rating to the new page (now at index 0)
      {
        op: 'add',
        path: '/pages/questions/0/blocks/-',
        value: {
          id: 'block-rating',
          type: 'rating',
          content: {
            label: '만족도를 평가해주세요',
            maxRating: 5
          }
        }
      }
    ];

    const newForm = JSON.parse(JSON.stringify(initialForm));
    const results = applyPatch(newForm, patches);
    expect(results.every(r => r === null)).toBe(true);

    const validated = validateResultingSchema(newForm);
    expect(validated.pages.questions.length).toBe(1);
    expect(validated.pages.questions[0].blocks.length).toBe(1);
  });

  it('Scenario 4: Metadata Alignment - "Change form title"', () => {
    const patches: Operation[] = [
      {
        op: 'replace',
        path: '/metadata/title',
        value: '개선된 설문조사'
      }
    ];

    const { isValid } = validatePatchesDetailed(patches, initialForm);
    expect(isValid).toBe(true);
    
    const newForm = JSON.parse(JSON.stringify(initialForm));
    applyPatch(newForm, patches);
    expect(newForm.metadata.title).toBe('개선된 설문조사');
  });

  it('Critical Failure Case: Mandatory Label Missing', () => {
    const patches: Operation[] = [
      {
        op: 'add',
        path: '/pages/questions/0/blocks/-',
        value: {
          id: 'no-label-block',
          type: 'text',
          content: { placeholder: 'Label is missing here' }
        }
      }
    ];

    const { isValid, errors } = validatePatchesDetailed(patches, initialForm);
    expect(isValid).toBe(false);
    expect(errors[0]).toContain('requires "content.label"');
  });
});
