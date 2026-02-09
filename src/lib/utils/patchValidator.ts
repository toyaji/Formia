import { Operation } from 'rfc6902';
import { FormFactor } from '../core/schema';

/**
 * Validates a list of JSON patches against a FormFactor schema.
 * Prevents 'remove' operations on blocks or pages marked as 'removable: false'.
 */
export function validatePatches(patches: Operation[], schema: FormFactor): Operation[] {
  return patches.filter(patch => {
    if (patch.op !== 'remove') return true;

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

    return true;
  });
}
