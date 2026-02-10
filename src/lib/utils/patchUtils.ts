import { applyPatch, Operation } from 'rfc6902';
import { PatchItem } from '@/store/useFormStore';
import { FormFactor, FormPage, FormBlock } from '@/lib/core/schema';

export type ReviewStatus = 'added' | 'removed' | 'modified' | 'kept';

export interface ReviewMetadata {
  status: ReviewStatus;
  patchId?: string; // Block-level or Page-level patch
  fieldPatches?: Record<string, PatchItem>;
}

export interface ReviewFormBlock extends FormBlock {
  reviewMetadata: ReviewMetadata;
}

export interface ReviewFormPage extends Omit<FormPage, 'blocks'> {
  blocks: ReviewFormBlock[];
  reviewMetadata: ReviewMetadata;
}

/**
 * Field target types for inline diff display
 * - 'block': Entire block add/remove
 * - 'label': Block label/title change
 * - 'options/0', 'options/1', etc.: Specific option add/remove/change
 * - 'form-title', 'form-description': Form metadata changes
 */

/**
 * Convert raw AI operations to PatchItems with field-level metadata
 */
export function convertOperationsToPatchItems(
  operations: Operation[],
  formFactor: FormFactor
): PatchItem[] {
  return operations.map((op, index) => {
    const { blockId, targetField, isNewBlock } = extractTargetInfo(op, formFactor, index);
    
    const patchItem: PatchItem = {
      id: `patch-${Date.now()}-${index}`,
      patch: op,
      status: 'pending',
      changeType: getChangeType(op.op),
      targetBlockId: blockId,
      targetField: targetField,
    };
    return patchItem;
  });
}

/**
 * Map operation type to change type for UI display
 */
function getChangeType(opType: string): 'add' | 'remove' | 'replace' {
  switch (opType) {
    case 'add':
      return 'add';
    case 'remove':
      return 'remove';
    case 'replace':
    case 'move':
    case 'copy':
    default:
      return 'replace';
  }
}

interface TargetInfo {
  blockId: string | undefined;
  targetField: string;
  isNewBlock: boolean;
}

/**
 * Extract detailed target info from a patch path
 * Examples:
 * - /pages/0/blocks/1/content/label -> blockId + 'label'
 * - /pages/0/blocks/1/content/options/2 -> blockId + 'options/2'
 * - /pages/0/blocks/- -> new-block-X + 'block'
 * - /pages/0/blocks/1 (remove) -> blockId + 'block'
 * - /metadata/title -> 'form-metadata' + 'form-title'
 */
function extractTargetInfo(op: Operation, formFactor: FormFactor, patchIndex: number): TargetInfo {
  const path = op.path;
  const parts = path.split('/').filter(Boolean);
  
  // Form metadata changes
  if (parts[0] === 'metadata') {
    const field = parts[1] === 'title' ? 'form-title' : 
                  parts[1] === 'description' ? 'form-description' : parts[1];
    return { blockId: 'form-metadata', targetField: field, isNewBlock: false };
  }
  
  // Page-level changes (blocks)
  // New paths: /pages/questions/0/blocks/1 or /pages/start/blocks/0 or /pages/ending/blocks/0
  if (parts[0] === 'pages' && parts.length >= 4 && parts.includes('blocks')) {
    const section = parts[1]; // 'start', 'questions', or 'endings'
    let page: FormPage | undefined;
    let blocksPartIndex = parts.indexOf('blocks');
    
    if (section === 'questions') {
      const qIndex = parseInt(parts[2], 10);
      page = formFactor.pages.questions[qIndex];
    } else if (section === 'endings') {
      const eIndex = parseInt(parts[2], 10);
      page = formFactor.pages.endings[eIndex];
    } else if (section === 'start') {
      page = formFactor.pages.start;
    }

    const blockIndex = parts[blocksPartIndex + 1];
    
    // Adding a new block
    if ((op.op === 'add' && parts.length === blocksPartIndex + 2) || blockIndex === '-') {
      const valueBlockId = (op as any).value?.id;
      return { 
        blockId: valueBlockId || `new-block-${patchIndex}`, 
        targetField: 'block', 
        isNewBlock: true 
      };
    }
    
    const blockIdx = parseInt(blockIndex, 10);
    const blockId = page?.blocks?.[blockIdx]?.id;
    
    // If path is exactly element-level, it's a block-level operation (remove/replace)
    if (parts.length === blocksPartIndex + 2) {
      return { blockId, targetField: 'block', isNewBlock: false };
    }
    
    // content/label
    if (parts[blocksPartIndex + 2] === 'content' && parts[blocksPartIndex + 3] === 'label') {
      return { blockId, targetField: 'label', isNewBlock: false };
    }
    
    // content/options/X
    if (parts[blocksPartIndex + 2] === 'content' && parts[blocksPartIndex + 3] === 'options') {
      const optionIndex = parts[blocksPartIndex + 4];
      return { blockId, targetField: `options/${optionIndex}`, isNewBlock: false };
    }
    
    // Other content fields
    if (parts[blocksPartIndex + 2] === 'content') {
      return { blockId, targetField: parts.slice(blocksPartIndex + 3).join('/') || 'content', isNewBlock: false };
    }
    
    // Block type change
    if (parts[blocksPartIndex + 2] === 'type') {
      return { blockId, targetField: 'type', isNewBlock: false };
    }
    
    return { blockId, targetField: 'block', isNewBlock: false };
  }
  
  // Page-level changes: /pages/start, /pages/questions/0, etc.
  if (parts[0] === 'pages') {
    const section = parts[1];
    if (section === 'questions' || section === 'endings') {
      const qIndex = parts[2];
      if (op.op === 'add' || qIndex === '-') {
        return { blockId: (op as any).value?.id || `new-page-${patchIndex}`, targetField: 'page', isNewBlock: true };
      }
      const idx = parseInt(qIndex, 10);
      const list = section === 'questions' ? formFactor.pages.questions : formFactor.pages.endings;
      const pageId = list[idx]?.id;
      return { blockId: pageId, targetField: 'page', isNewBlock: false };
    } else if (section === 'start') {
      const pageId = formFactor.pages.start?.id;
      return { blockId: pageId, targetField: 'page', isNewBlock: false };
    }
  }
  
  return { blockId: undefined, targetField: 'unknown', isNewBlock: false };
}

/**
 * Get pending patches for a specific block AND field
 */
export function getPendingPatchForField(
  blockId: string,
  fieldPath: string,
  pendingPatches: PatchItem[]
): PatchItem | undefined {
  return pendingPatches.find(
    p => p.targetBlockId === blockId && 
         p.targetField === fieldPath && 
         p.status === 'pending'
  );
}

/**
 * Get ALL pending patches for a specific block
 */
export function getAllPendingPatchesForBlock(
  blockId: string,
  pendingPatches: PatchItem[]
): PatchItem[] {
  return pendingPatches.filter(
    p => p.targetBlockId === blockId && p.status === 'pending'
  );
}

/**
 * Check if a block has a block-level change (add/remove entire block)
 */
export function hasBlockLevelChange(
  blockId: string,
  pendingPatches: PatchItem[]
): PatchItem | undefined {
  return pendingPatches.find(
    p => p.targetBlockId === blockId && 
         p.targetField === 'block' && 
         p.status === 'pending'
  );
}

/**
 * Get pending patches for options within a block
 * Returns patches like 'options/0', 'options/1', etc.
 */
export function getOptionPatches(
  blockId: string,
  pendingPatches: PatchItem[]
): PatchItem[] {
  return pendingPatches.filter(
    p => p.targetBlockId === blockId && 
         p.targetField?.startsWith('options/') && 
         p.status === 'pending'
  );
}

/**
 * Get the patch for a specific option index
 */
export function getOptionPatch(
  blockId: string,
  optionIndex: number | string,
  pendingPatches: PatchItem[]
): PatchItem | undefined {
  return pendingPatches.find(
    p => p.targetBlockId === blockId && 
         (p.targetField === `options/${optionIndex}` || p.targetField === 'options/-') && 
         p.status === 'pending'
  );
}

/**
 * Get new blocks that need to be rendered as previews
 */
export function getNewBlockPreviews(
  pendingPatches: PatchItem[]
): Array<{ patchIds: string[], block: any, targetBlockId: string }> {
  return pendingPatches
    .filter(p => 
      p.status === 'pending' && 
      p.targetField === 'block' &&
      p.changeType === 'add' && 
      p.targetBlockId?.startsWith('new-block-') &&
      p.patch.op === 'add'
    )
    .map(p => ({
      patchIds: [p.id],
      block: (p.patch as any).value,
      targetBlockId: p.targetBlockId!
    }));
}

/**
 * Check if a specific block has any pending changes (for backwards compat)
 */
export function blockHasPendingChanges(
  blockId: string,
  pendingPatches: PatchItem[]
): PatchItem | undefined {
  return pendingPatches.find(
    p => p.targetBlockId === blockId && p.status === 'pending'
  );
}

/**
 * Get the change type for a specific block (for block-level styling)
 */
export function getBlockChangeType(
  blockId: string,
  pendingPatches: PatchItem[]
): 'add' | 'remove' | 'replace' | null {
  const blockPatch = hasBlockLevelChange(blockId, pendingPatches);
  if (blockPatch) return blockPatch.changeType;
  return null;
}

/**
 * Create a merged list of pages for Review Mode
 * - Uses stable IDs to match Snapshot and Target state.
 * - Injects 'removed' items.
 * - Marks 'added' and 'modified' statuses.
 */
export function buildReviewModel(
  snapshot: FormFactor | null,
  effective: FormFactor | null,
  pendingPatches: PatchItem[]
): ReviewFormPage[] {
  if (!snapshot || !effective) return [];

  const pending = pendingPatches.filter(p => p.status === 'pending');

  const processPage = (
    originalPage: FormPage | undefined,
    targetPage: FormPage | undefined,
    section: string,
    index?: number
  ): ReviewFormPage | null => {
    if (!originalPage && !targetPage) return null;

    const isRemoved = !!originalPage && !targetPage;
    const isAdded = !originalPage && !!targetPage;
    const page = targetPage || originalPage!;

    const reviewMetadata: ReviewMetadata = {
      status: isRemoved ? 'removed' : (isAdded ? 'added' : 'kept'),
      patchId: undefined
    };

    // Find page-level patch
    if (isRemoved) {
      const path = (section === 'questions' || section === 'endings') ? `/pages/${section}/${index}` : `/pages/${section}`;
      reviewMetadata.patchId = pending.find(p => p.changeType === 'remove' && p.patch.path === path)?.id;
    } else if (isAdded) {
      // Find add patch for this page. Fallback to targetBlockId comparison if value.id doesn't match
      reviewMetadata.patchId = pending.find(p => 
        p.changeType === 'add' && 
        ((p.patch as any).value?.id === page.id || p.targetBlockId === page.id)
      )?.id;
    }

    const blocks = mergeReviewBlocks(
      originalPage?.blocks || [],
      targetPage?.blocks || [],
      pending,
      isAdded
    );

    if (reviewMetadata.status === 'kept' && originalPage && targetPage) {
      if (originalPage.title !== targetPage.title) {
        reviewMetadata.status = 'modified';
      }
    }

    return {
      ...page,
      blocks: isRemoved ? blocks.map(b => ({ ...b, reviewMetadata: { status: 'removed' as const } })) : blocks,
      reviewMetadata
    };
  };

  const result: ReviewFormPage[] = [];

  // 1. Start Page
  const startPage = processPage(snapshot.pages.start, effective.pages.start, 'start');
  if (startPage) result.push(startPage);

  // 2. Question Pages
  const allQuestionIds = new Set([
    ...snapshot.pages.questions.map(p => p.id),
    ...effective.pages.questions.map(p => p.id)
  ]);

  // To maintain order, we iterate through snapshot first, then append new ones from effective
  const handledIds = new Set<string>();
  
  // Snapshot order (with removals injected)
  snapshot.pages.questions.forEach((op, idx) => {
    const tp = effective.pages.questions.find(p => p.id === op.id);
    const rp = processPage(op, tp, 'questions', idx);
    if (rp) {
      result.push(rp);
      handledIds.add(op.id);
    }
  });

  // Append newly added pages that weren't in snapshot
  effective.pages.questions.forEach((tp, idx) => {
    if (!handledIds.has(tp.id)) {
      const rp = processPage(undefined, tp, 'questions', idx);
      if (rp) result.push(rp);
    }
  });

  // 3. Ending Pages
  const allEndingIds = new Set([
    ...snapshot.pages.endings.map(p => p.id),
    ...effective.pages.endings.map(p => p.id)
  ]);

  const handledEndIds = new Set<string>();
  
  snapshot.pages.endings.forEach((op, idx) => {
    const tp = effective.pages.endings.find(p => p.id === op.id);
    const rp = processPage(op, tp, 'endings', idx);
    if (rp) {
      result.push(rp);
      handledEndIds.add(op.id);
    }
  });

  effective.pages.endings.forEach((tp, idx) => {
    if (!handledEndIds.has(tp.id)) {
      const rp = processPage(undefined, tp, 'endings', idx);
      if (rp) result.push(rp);
    }
  });

  return result;
}

/**
 * Ensures pages follow the strict order: Start -> Default -> Ending
 */
export function sortPages(pages: any): any {
  // Sorting is now implicitly handled by the schema structure.
  // This is kept for API compatibility but returns as is for the questions array specifically if needed.
  return pages;
}

/**
 * Merges original and target blocks using stable IDs
 */
function mergeReviewBlocks(
  originalBlocks: any[],
  targetBlocks: any[],
  pending: PatchItem[],
  isNewPage: boolean
): ReviewFormBlock[] {
  const result: ReviewFormBlock[] = targetBlocks.map(block => {
    const originalBlock = originalBlocks.find(b => b.id === block.id);
    const isNew = !originalBlock;

    // Resolve field-level patches for this block
    const fieldPatches: Record<string, PatchItem> = {};
    pending
      .filter(p => p.targetBlockId === block.id && p.targetField !== 'block')
      .forEach(p => {
        if (p.targetField) fieldPatches[p.targetField] = p;
      });

    let status: ReviewStatus = isNew ? 'added' : 'kept';
    if (!isNew && Object.keys(fieldPatches).length > 0) {
      status = 'modified';
    }

    // Find block-level patch (for added blocks)
    const blockPatch = isNew 
      ? pending.find(p => p.targetBlockId === block.id && p.targetField === 'block' && p.changeType === 'add')
      : undefined;

    return {
      ...block,
      reviewMetadata: {
        status,
        patchId: blockPatch?.id,
        fieldPatches
      }
    };
  });

  // Only inject removed blocks if parent page wasn't new
  if (!isNewPage) {
    const targetBlockIds = new Set(targetBlocks.map(b => b.id));
    originalBlocks.forEach((originalBlock, index) => {
      if (!targetBlockIds.has(originalBlock.id)) {
        // Find removal patch for this specific block
        const patch = pending.find(p => p.targetBlockId === originalBlock.id && p.changeType === 'remove');
        
        const reviewBlock: ReviewFormBlock = {
          ...originalBlock,
          reviewMetadata: {
            status: 'removed',
            patchId: patch?.id
          }
        };
        
        // Insertion heuristic
        const insertAt = Math.min(index, result.length);
        result.splice(insertAt, 0, reviewBlock);
      }
    });
  }

  return result;
}
