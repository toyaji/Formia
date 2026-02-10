import { Operation } from 'rfc6902';
import { FormFactor, BlockTypeSchema } from '../core/schema';

/**
 * Detailed validation result
 */
interface ValidationResult {
  validPatches: Operation[];
  errors: string[];
}

/**
 * Validates a list of JSON patches against a FormFactor schema.
 * Prevents 'remove' operations on blocks or pages marked as 'removable: false'.
 * Also validates that new blocks/pages have valid structure.
 */
export function validatePatchesDetailed(patches: Operation[], schema: FormFactor): ValidationResult {
  const validBlockTypes = BlockTypeSchema.options;
  const validPageTypes = ['start', 'default', 'ending'];
  const errors: string[] = [];

  const validPatches = patches.filter(patch => {
    // 1. Validate removal
    if (patch.op === 'remove') {
      const path = patch.path;
      
      // Page removal
      const pageMatch = path.match(/^\/pages\/(\d+)$/);
      if (pageMatch) {
        const pageIndex = parseInt(pageMatch[1], 10);
        const page = schema.pages[pageIndex];
        if (page && page.removable === false) {
          errors.push(`Cannot remove non-removable page: ${page.id}`);
          return false;
        }
      }

      // Block removal
      const blockMatch = path.match(/^\/pages\/(\d+)\/blocks\/(\d+)$/);
      if (blockMatch) {
        const pageIndex = parseInt(blockMatch[1], 10);
        const blockIndex = parseInt(blockMatch[2], 10);
        const block = schema.pages[pageIndex]?.blocks[blockIndex];
        if (block && block.removable === false) {
          errors.push(`Cannot remove non-removable block: ${block.id}`);
          return false;
        }
      }
    }

    // 2. Validate addition or replacement of types
    if (patch.op === 'add' || patch.op === 'replace') {
      // Block addition
      const blockAddMatch = patch.path.match(/^\/pages\/\d+\/blocks\/(\d+|-)$/);
      if (blockAddMatch && patch.op === 'add') {
        const v = patch.value as any;
        if (!v || !v.id || !v.type || !v.content) {
          errors.push(`Incomplete block structure at ${patch.path}. Missing id, type, or content.`);
          return false;
        }
        if (!validBlockTypes.includes(v.type as any)) {
          errors.push(`Invalid block type: "${v.type}". Valid types are: ${validBlockTypes.join(', ')}`);
          return false;
        }
      }

      // Block type replacement
      const blockTypeMatch = patch.path.match(/^\/pages\/\d+\/blocks\/\d+\/type$/);
      if (blockTypeMatch) {
        const type = patch.value as string;
        if (!validBlockTypes.includes(type as any)) {
          errors.push(`Invalid block type replacement: "${type}". Valid types are: ${validBlockTypes.join(', ')}`);
          return false;
        }
      }

      // Page addition
      const pageAddMatch = patch.path.match(/^\/pages\/(\d+|-)$/);
      if (pageAddMatch && patch.op === 'add') {
        const v = patch.value as any;
        if (!v || !v.id || !v.type || !v.title || !Array.isArray(v.blocks)) {
          errors.push(`Incomplete page structure at ${patch.path}. Missing id, type, title, or blocks array.`);
          return false;
        }
        if (!validPageTypes.includes(v.type)) {
          errors.push(`Invalid page type: "${v.type}". Valid types are: ${validPageTypes.join(', ')}`);
          return false;
        }
      }

      // Page type replacement
      const pageTypeMatch = patch.path.match(/^\/pages\/\d+\/type$/);
      if (pageTypeMatch) {
        const type = patch.value as string;
        if (!validPageTypes.includes(type)) {
          errors.push(`Invalid page type replacement: "${type}". Valid types are: ${validPageTypes.join(', ')}`);
          return false;
        }
      }
    }

    return true;
  });

  return { validPatches, errors };
}

export function validatePatches(patches: Operation[], schema: FormFactor): Operation[] {
  return validatePatchesDetailed(patches, schema).validPatches;
}
