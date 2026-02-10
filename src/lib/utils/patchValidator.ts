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
      
      // Page removal: /pages/questions/0
      const pageMatch = path.match(/^\/pages\/questions\/(\d+)$/);
      if (pageMatch) {
        const pageIndex = parseInt(pageMatch[1], 10);
        const page = schema.pages.questions[pageIndex];
        if (page && page.removable === false) {
          errors.push(`Cannot remove non-removable page: ${page.id}`);
          return false;
        }
      }

      // Special cases for start
      if (path === '/pages/start') {
        const page = schema.pages.start;
        if (page && page.removable === false) {
          errors.push(`Cannot remove non-removable page: ${page?.id || 'start'}`);
          return false;
        }
      }

      // Endings removal: /pages/endings/0
      const endingsMatch = path.match(/^\/pages\/endings\/(\d+)$/);
      if (endingsMatch) {
          const pageIndex = parseInt(endingsMatch[1], 10);
          const page = schema.pages.endings[pageIndex];
          if (page && page.removable === false) {
              errors.push(`Cannot remove non-removable page: ${page.id}`);
              return false;
          }
      }

      // Block removal: /pages/(start|questions\/\d+|endings\/\d+)\/blocks\/\d+
      const blockMatch = path.match(/^\/pages\/(start|questions\/\d+|endings\/\d+)\/blocks\/(\d+)$/);
      if (blockMatch) {
        const sectionPath = blockMatch[1];
        const blockIndex = parseInt(blockMatch[2], 10);
        let page: any;
        if (sectionPath === 'start') {
          page = schema.pages.start;
        } else if (sectionPath.startsWith('endings/')) {
          const eIndex = parseInt(sectionPath.split('/')[1], 10);
          page = schema.pages.endings[eIndex];
        } else if (sectionPath.startsWith('questions/')) {
          const qIndex = parseInt(sectionPath.split('/')[1], 10);
          page = schema.pages.questions[qIndex];
        }
        const block = page?.blocks?.[blockIndex];
        if (block && block.removable === false) {
          errors.push(`Cannot remove non-removable block: ${block.id}`);
          return false;
        }
      }
    }

    // 2. Validate addition or replacement of types
    if (patch.op === 'add' || patch.op === 'replace') {
      const path = patch.path;

      // Block addition: /pages/(start|questions\/\d+|endings\/\d+)/blocks/(\d+|-)
      const blockAddMatch = path.match(/^\/pages\/(start|questions\/\d+|endings\/\d+)\/blocks\/(\d+|-)$/);
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

      // Block type replacement: /pages/(start|questions\/\d+|endings\/\d+)/blocks/\d+/type
      const blockTypeMatch = path.match(/^\/pages\/(start|questions\/\d+|endings\/\d+)\/blocks\/\d+\/type$/);
      if (blockTypeMatch) {
        const type = patch.value as string;
        if (!validBlockTypes.includes(type as any)) {
          errors.push(`Invalid block type replacement: "${type}". Valid types are: ${validBlockTypes.join(', ')}`);
          return false;
        }
      }

      // Page addition: /pages/questions/(\d+|-) or /pages/endings/(\d+|-)
      const pageAddMatch = path.match(/^\/pages\/(questions|endings)\/(\d+|-)$/);
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

      // Page type replacement: /pages/(start|questions\/\d+|endings\/\d+)/type
      const pageTypeMatch = path.match(/^\/pages\/(start|questions\/\d+|endings\/\d+)\/type$/);
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
