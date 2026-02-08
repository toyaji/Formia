import { Operation } from 'rfc6902';
import { PatchItem } from '@/store/useFormStore';
import { FormFactor } from '@/lib/core/schema';

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
    const { blockId, targetField, isNewBlock } = extractTargetInfo(op.path, formFactor, index);
    
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
function extractTargetInfo(path: string, formFactor: FormFactor, patchIndex: number): TargetInfo {
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
    
    // Adding a new block (path ends with -)
    if (blockIndex === '-') {
      return { 
        blockId: `new-block-${patchIndex}`, 
        targetField: 'block', 
        isNewBlock: true 
      };
    }
    
    const blockIdx = parseInt(blockIndex, 10);
    const page = formFactor.pages[pageIndex];
    const blockId = page?.blocks[blockIdx]?.id;
    
    // If path is exactly /pages/X/blocks/Y, it's a block-level operation
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
