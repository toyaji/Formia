import { BlockType } from '@/lib/core/schema';

export interface BlockTypeMetadata {
  label: string;
  icon: string;
}

export const BLOCK_METADATA: Record<BlockType, BlockTypeMetadata> = {
  text: { label: '단답형', icon: '/assets/icons/text.png' },
  textarea: { label: '장문형', icon: '/assets/icons/textarea.png' },
  choice: { label: '선택형', icon: '/assets/icons/choice.png' },
  rating: { label: '평가형', icon: '/assets/icons/rating.png' },
  date: { label: '날짜', icon: '/assets/icons/date.png' },
  file: { label: '파일', icon: '/assets/icons/file.png' },
  info: { label: '안내', icon: '/assets/icons/info.png' },
  statement: { label: '문구', icon: '/assets/icons/statement.png' },
};
