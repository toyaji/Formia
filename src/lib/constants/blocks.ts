import { BlockType } from '@/lib/core/schema';

export interface BlockTypeMetadata {
  label: string;
  icon: string;
}

export const BLOCK_METADATA: Record<BlockType, BlockTypeMetadata> = {
  text: { label: '단답형', icon: 'T' },
  textarea: { label: '장문형', icon: 'Ta' },
  choice: { label: '선택형', icon: 'C' },
  rating: { label: '평가형', icon: 'R' },
  date: { label: '날짜', icon: 'D' },
  file: { label: '파일', icon: 'F' },
  info: { label: '안내', icon: 'i' },
  statement: { label: '문구', icon: 'S' },
};
