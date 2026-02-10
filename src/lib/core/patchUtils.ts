import { Operation } from 'rfc6902';
import { FormBlock } from './schema';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a patch to add a new block at the end of the blocks array.
 */
export const createAddBlockPatch = (block: Partial<FormBlock>): Operation => {
  const fullBlock: FormBlock = {
    id: uuidv4(),
    type: block.type || 'text',
    content: block.content || { label: 'New Field' },
    removable: true,
    validation: block.validation || { required: false },
    ...block,
  };

  return {
    op: 'add',
    path: '/blocks/-',
    value: fullBlock,
  };
};

/**
 * Creates a patch to remove a block by index.
 */
export const createRemoveBlockPatch = (index: number): Operation => {
  return {
    op: 'remove',
    path: `/blocks/${index}`,
  };
};

/**
 * Creates a patch to update a specific field in a block.
 */
export const createUpdateBlockPatch = (index: number, path: string, value: any): Operation => {
  return {
    op: 'replace',
    path: `/blocks/${index}/${path}`,
    value,
  };
};
