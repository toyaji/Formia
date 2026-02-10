import { applyPatch, Operation } from 'rfc6902';
import { PatchItem } from '@/store/useFormStore';
import { FormFactor, FormPage } from '@/lib/core/schema';

export type ReviewPageStatus = 'added' | 'removed' | 'kept';

export interface ReviewFormPage extends FormPage {
  reviewStatus: ReviewPageStatus;
  relatedPatchId?: string;
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
      return { 
        blockId: `new-block-${patchIndex}`, 
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
 * - Shows currently active pages (kept + added)
 * - Injects deleted pages back into the list with 'removed' status
 */
export function getReviewPages(
  originalPages: FormPage[] | undefined,
  effectivePages: FormPage[],
  pendingPatches: PatchItem[] = []
): ReviewFormPage[] {
  const original = originalPages || [];
  
  // 1. Mark effective pages as 'kept' or 'added'
  const result: ReviewFormPage[] = effectivePages.map(page => {
    const isNew = !original.find(p => p.id === page.id);
    let patchId: string | undefined;
    
    if (isNew) {
      // Find the patch that added this page
      // Look for 'add' operation where value.id matches page.id
      const patch = pendingPatches.find(p => 
        p.changeType === 'add' && 
        (p.patch as any).value?.id === page.id
      );
      patchId = patch?.id;
    }
    
    return {
      ...page,
      reviewStatus: isNew ? 'added' : 'kept',
      relatedPatchId: patchId
    };
  });

  // 2. Identify removed pages and inject them
  const effectiveIdSet = new Set(effectivePages.map(p => p.id));
  
  // Find removed pages with their original index
  const removedPages = original
    .map((page, index) => ({ page, index }))
    .filter(item => !effectiveIdSet.has(item.page.id));

  // Insert removed pages. 
  removedPages.forEach(({ page, index }) => {
     // Find the patch that removed this page
     // Heuristic: Look for 'remove' operation targeting this path index
     // Note: This relies on patches strictly matching original indices or being simple
     const patch = pendingPatches.find(p => 
       p.changeType === 'remove' && 
       p.patch.path === `/pages/${index}`
     );
     
     const reviewPage: ReviewFormPage = { 
       ...page, 
       reviewStatus: 'removed',
       relatedPatchId: patch?.id 
     };
     
     const insertAt = Math.min(index, result.length);
     result.splice(insertAt, 0, reviewPage);
  });
  
  // 3. Sort pages: Start < Default < Ending
  // This ensures that even if a new page is appended by AI, it appears before the Ending page.
  const typePriority = {
    start: 0,
    default: 1,
    ending: 2,
  };

  result.sort((a, b) => {
    const priorityA = typePriority[a.type || 'default'] ?? 1;
    const priorityB = typePriority[b.type || 'default'] ?? 1;
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    // Stable sort for same type (preserve relative order)
    return 0;
  });
  
  return result;
}
