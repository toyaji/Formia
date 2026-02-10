import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { useFormStore } from '@/store/useFormStore';
import { ReviewFormPage } from '@/lib/utils/patchUtils';
import styles from './EditablePageTitle.module.css';
import diffStyles from './PageDiff.module.css';

interface EditablePageTitleProps {
  page: ReviewFormPage;
  isActive: boolean;
  isAdded: boolean;
  isRemoved: boolean;
  isReviewMode: boolean;
  patchId?: string | null;
}

export const EditablePageTitle = ({
  page,
  isActive,
  isAdded,
  isRemoved,
  isReviewMode,
  patchId
}: EditablePageTitleProps) => {
  const { applyJsonPatch, resolvePagePatch } = useFormStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(page.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRemoved) return;
    setIsEditing(true);
    setEditValue(page.title);
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== page.title) {
        // Find path
        let path = '';
        const { formFactor } = useFormStore.getState();
        if (formFactor?.pages.start?.id === page.id) path = '/pages/start/title';
        else if (formFactor?.pages.ending?.id === page.id) path = '/pages/ending/title';
        else {
            const qIdx = formFactor?.pages.questions.findIndex(p => p.id === page.id);
            if (qIdx !== undefined && qIdx !== -1) path = `/pages/questions/${qIdx}/title`;
        }

        if (path) {
            applyJsonPatch([{
                op: 'replace',
                path,
                value: trimmed
            }]);
        }
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(page.title);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  if (isEditing) {
    return (
      <div className={styles.editWrapper}>
        <input
          ref={inputRef}
          type="text"
          className={styles.titleInput}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={onKeyDown}
          autoFocus
        />
      </div>
    );
  }

  // Combined Status Color logic from app/page.tsx
  const color = isRemoved ? '#EF4444' : (isAdded ? '#22C55E' : (isActive ? 'var(--f-primary)' : 'var(--f-text-muted)'));

  return (
    <div 
        className={styles.container}
        onDoubleClick={handleStartEdit}
    >
      <span 
        className={styles.titleText}
        style={{ color }}
      >
        {page.title}
      </span>
      
      {!isRemoved && !isReviewMode && (
        <button 
            className={styles.editButton} 
            onClick={handleStartEdit}
            title="페이지 이름 수정"
        >
          <Pencil size={12} />
        </button>
      )}

      {isReviewMode && (isAdded || isRemoved) && patchId && (
        <div className={diffStyles.reviewChip} data-change-type={isAdded ? 'add' : 'remove'} style={{ marginLeft: '8px' }}>
          <button onClick={(e) => { e.stopPropagation(); resolvePagePatch(patchId!, 'accept'); }}>
            <Check size={12} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); resolvePagePatch(patchId!, 'reject'); }}>
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};
