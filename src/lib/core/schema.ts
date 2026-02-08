import { z } from 'zod';

/**
 * Design Tokens Schema
 */
export const DesignTokensSchema = z.object({
  primary: z.string().optional(),
  background: z.string().optional(),
  surface: z.string().optional(),
  textMain: z.string().optional(),
  textMuted: z.string().optional(),
  border: z.string().optional(),
  radius: z.string().optional(),
});

/**
 * Form Block Types
 */
export const BlockTypeSchema = z.enum([
  'text',
  'textarea',
  'choice',
  'rating',
  'date',
  'file',
  'info', // For markdown/text blocks
]);

/**
 * Block Content Schema (flexible per type)
 */
export const BlockContentSchema = z.object({
  label: z.string().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  options: z.array(z.string()).optional(), // For choice
  maxRating: z.number().optional(), // For rating
  body: z.string().optional(), // For info
});

/**
 * Form Block Schema
 */
export const BlockSchema = z.object({
  id: z.string(),
  type: BlockTypeSchema,
  content: BlockContentSchema,
  validation: z.object({
    required: z.boolean().default(false),
    pattern: z.string().optional(),
  }).optional(),
  style: z.record(z.any()).optional(),
});

/**
 * Page Schema
 */
export const PageSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  blocks: z.array(BlockSchema),
});

/**
 * Main Form Factor Schema (v2)
 */
export const FormFactorSchema = z.object({
  version: z.string().default('2.0.0'),
  metadata: z.object({
    title: z.string(),
    description: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  theme: z.object({
    mode: z.enum(['light', 'dark', 'system']).default('light'),
    tokens: DesignTokensSchema,
  }),
  pages: z.array(PageSchema),
  settings: z.object({
    submitButtonLabel: z.string().default('제출하기'),
    successMessage: z.string().default('성공적으로 제출되었습니다.'),
  }).optional(),
});

export type FormFactor = z.infer<typeof FormFactorSchema>;
export type FormPage = z.infer<typeof PageSchema>;
export type FormBlock = z.infer<typeof BlockSchema>;
export type BlockType = z.infer<typeof BlockTypeSchema>;
export type DesignTokens = z.infer<typeof DesignTokensSchema>;
