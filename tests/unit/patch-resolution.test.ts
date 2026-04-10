import { describe, it, expect } from 'vitest';
import { applyPatch, Operation } from 'rfc6902';
import { FormFactor, FormFactorSchema } from '../../src/lib/core/schema';

describe('JSON Patch Resolution Unit Tests', () => {
  const getBaseSchema = (): FormFactor => ({
    version: "2.0.0",
    metadata: {
      title: "Test Form",
      updatedAt: "2024-01-01",
      createdAt: "2024-01-01"
    },
    theme: { mode: "light", tokens: {} },
    pages: {
      start: { id: "page-start", type: "start", title: "Start", blocks: [] },
      questions: [
        { id: "page-q", type: "default", title: "Questions", blocks: [] }
      ],
      endings: []
    }
  });

  it('should successfully add a text block with a valid label', () => {
    const schema = getBaseSchema();
    const patch: Operation[] = [
      {
        op: "add",
        path: "/pages/questions/0/blocks/-",
        value: {
          id: "block-1",
          type: "text",
          content: { label: "이름을 입력하세요" },
          validation: { required: true }
        }
      }
    ];

    const result = applyPatch(schema, patch);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull(); // null means success in rfc6902

    // Validate the resulting object matches Zod schema
    const parsed = FormFactorSchema.safeParse(schema);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.pages.questions[0].blocks).toHaveLength(1);
      expect(parsed.data.pages.questions[0].blocks[0].content.label).toBe("이름을 입력하세요");
    }
  });

  it('should invalidate when label is missing on a strict configuration (though optional in schema, we test AI behavior)', () => {
    const schema = getBaseSchema();
    const patch: Operation[] = [
      {
        op: "add",
        path: "/pages/questions/0/blocks/-",
        value: {
          id: "block-2",
          type: "text"
          // Missing content and label! UI would break.
        }
      }
    ];

    applyPatch(schema, patch);

    // FormFactorSchema requires `content` object natively in zod
    const parsed = FormFactorSchema.safeParse(schema);
    expect(parsed.success).toBe(false); // Should fail because `content` is completely missing
  });
});
