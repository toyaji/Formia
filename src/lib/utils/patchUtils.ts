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
  if (parts[0] === 'pages' && parts.length >= 4 && parts[2] === 'blocks') {
    const pageIndex = parseInt(parts[1], 10);
    const blockIndex = parts[3];
    
    // Adding a new block (either explicit add to array or using '-' index)
    // If op is 'add' and we are targeting the blocks array item directly (/pages/0/blocks/X)
    if ((op.op === 'add' && parts.length === 4) || blockIndex === '-') {
      const valueBlockId = (op as any).value?.id;
      return { 
        blockId: valueBlockId || `new-block-${patchIndex}`, 
        targetField: 'block', 
        isNewBlock: true 
      };
    }
    
    const blockIdx = parseInt(blockIndex, 10);
    const page = formFactor.pages[pageIndex];
    const blockId = page?.blocks?.[blockIdx]?.id;
    
    // If path is exactly /pages/X/blocks/Y, it's a block-level operation (remove/replace)
    if (parts.length === 4) {
      return { blockId, targetField: 'block', isNewBlock: false };
    }
    
    // content/label
    if (parts[4] === 'content' && parts[5] === 'label') {
      return { blockId, targetField: 'label', isNewBlock: false };
    }
    
    // content/options/X or content/options/-
    if (parts[4] === 'content' && parts[5] === 'options') {
      const optionIndex = parts[6];
      return { blockId, targetField: `options/${optionIndex}`, isNewBlock: false };
    }
    
    // Other content fields (placeholder, required, etc.)
    if (parts[4] === 'content') {
      return { blockId, targetField: parts.slice(5).join('/') || 'content', isNewBlock: false };
    }
    
    // Block type change
    if (parts[4] === 'type') {
      return { blockId, targetField: 'type', isNewBlock: false };
    }
    
    return { blockId, targetField: 'block', isNewBlock: false };
  }
  
  // Page-level changes: /pages/0 or /pages/-
  if (parts[0] === 'pages' && parts.length === 2) {
    const pageIndex = parts[1];
    if (op.op === 'add' || pageIndex === '-') {
      return { blockId: (op as any).value?.id || `new-page-${patchIndex}`, targetField: 'page', isNewBlock: true };
    }
    const idx = parseInt(pageIndex, 10);
    const pageId = formFactor.pages[idx]?.id;
    return { blockId: pageId, targetField: 'page', isNewBlock: false };
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

  const originalPages = snapshot.pages || [];
  const targetPages = effective.pages || [];
  const pending = pendingPatches.filter(p => p.status === 'pending');

  // 1. Map target pages to ReviewFormPage
  const result: ReviewFormPage[] = targetPages.map((page, pageIdx) => {
    const originalPage = originalPages.find(p => p.id === page.id);
    const isNew = !originalPage;

    // Resolve ReviewMetadata for page
    const reviewMetadata: ReviewMetadata = {
      status: isNew ? 'added' : 'kept',
      patchId: isNew ? pending.find(p => p.changeType === 'add' && (p.patch as any).value?.id === page.id)?.id : undefined
    };

    // Merge blocks within this page
    const blocks = mergeReviewBlocks(
      originalPage?.blocks || [],
      page.blocks,
      pending,
      isNew
    );

    // If not new, check if label or other page fields changed
    if (!isNew && originalPage) {
      if (originalPage.title !== page.title) {
        reviewMetadata.status = 'modified';
        // Field-level metadata could be added here if needed for page title
      }
    }

    return {
      ...page,
      blocks,
      reviewMetadata
    };
  });

  // 2. Identify and inject removed pages from snapshot
  const targetPageIds = new Set(targetPages.map(p => p.id));
  originalPages.forEach((originalPage, index) => {
    if (!targetPageIds.has(originalPage.id)) {
      // Find the removal patch
      const patch = pending.find(p => p.changeType === 'remove' && p.patch.path === `/pages/${index}`);
      
      const reviewPage: ReviewFormPage = {
        ...originalPage,
        blocks: originalPage.blocks.map(b => ({
          ...b,
          reviewMetadata: { status: 'removed' }
        })),
        reviewMetadata: {
          status: 'removed',
          patchId: patch?.id
        }
      };

      // Heuristic: Insert at original index
      const insertAt = Math.min(index, result.length);
      result.splice(insertAt, 0, reviewPage);
    }
  });

  // 3. Re-sort by structural priority (Start -> Default -> Ending)
  return sortPages(result);
}

/**
 * Ensures pages follow the strict order: Start -> Default -> Ending
 */
export function sortPages<T extends { type?: string }>(pages: T[]): T[] {
  const typePriority: Record<string, number> = { start: 0, default: 1, ending: 2 };

  return [...pages].sort((a, b) => {
    const priorityA = typePriority[a.type || 'default'] ?? 1;
    const priorityB = typePriority[b.type || 'default'] ?? 1;
    return priorityA - priorityB;
  });
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
