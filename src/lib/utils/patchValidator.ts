import { Operation } from 'rfc6902';
import { FormFactor, BlockTypeSchema } from '../core/schema';

/**
 * Validates a list of JSON patches against a FormFactor schema.
 * Prevents 'remove' operations on blocks or pages marked as 'removable: false'.
 * Also validates that new blocks have valid types.
 */
export function validatePatches(patches: Operation[], schema: FormFactor): Operation[] {
  const validBlockTypes = BlockTypeSchema.options;

  return patches.filter(patch => {
    // 1. Validate block removal
    if (patch.op === 'remove') {
      const path = patch.path;
      
      // Check for page removal: /pages/n
      const pageMatch = path.match(/^\/pages\/(\d+)$/);
      if (pageMatch) {
        const pageIndex = parseInt(pageMatch[1], 10);
        const page = schema.pages[pageIndex];
        if (page && page.removable === false) {
          console.warn(`[PatchValidator] Rejecting removal of non-removable page: ${page.id} (${page.title})`);
          return false;
        }
      }

      // Check for block removal: /pages/n/blocks/m
      const blockMatch = path.match(/^\/pages\/(\d+)\/blocks\/(\d+)$/);
      if (blockMatch) {
        const pageIndex = parseInt(blockMatch[1], 10);
        const blockIndex = parseInt(blockMatch[2], 10);
        const block = schema.pages[pageIndex]?.blocks[blockIndex];
        if (block && block.removable === false) {
          console.warn(`[PatchValidator] Rejecting removal of non-removable block: ${block.id} (${block.type})`);
          return false;
        }
      }
    }

    // 2. Validate block addition (valid type check)
    if (patch.op === 'add') {
      const blockAddMatch = patch.path.match(/^\/pages\/\d+\/blocks\/(\d+|-)$/);
      if (blockAddMatch) {
        const blockValue = patch.value as any;
        if (blockValue && blockValue.type && !validBlockTypes.includes(blockValue.type)) {
          console.warn(`[PatchValidator] Rejecting addition of block with invalid type: ${blockValue.type}`);
          return false;
        }
      }
    }

    return true;
  });
}
