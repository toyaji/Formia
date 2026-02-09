import { FormBlock } from '@/lib/core/schema';
import styles from './BlockRenderer.module.css';
import { useFormStore, PatchItem } from '@/store/useFormStore';
import { Trash2, Plus, X, Check } from 'lucide-react';
import { 
  hasBlockLevelChange, 
  getPendingPatchForField,
  getOptionPatches,
  getAllPendingPatchesForBlock 
} from '@/lib/utils/patchUtils';

interface BlockRendererProps {
  block: FormBlock;
  previewBlockId?: string;
}

// Mini component for field-level diff overlay
const FieldDiffBadge = ({ 
  patch, 
  onAccept, 
  onReject 
}: { 
  patch: PatchItem; 
  onAccept: () => void; 
  onReject: () => void;
}) => (
  <div 
    className={styles.fieldDiffBadge} 
    data-change-type={patch.changeType}
    onClick={(e) => e.stopPropagation()}
  >
    <span className={styles.fieldDiffLabel}>
      {patch.changeType === 'add' && '추가'}
      {patch.changeType === 'remove' && '삭제'}
      {patch.changeType === 'replace' && '수정'}
    </span>
    <button 
      className={styles.fieldDiffAcceptBtn}
      onClick={(e) => { e.stopPropagation(); onAccept(); }}
      title="수락"
    >
      <Check size={12} />
    </button>
    <button 
      className={styles.fieldDiffRejectBtn}
      onClick={(e) => { e.stopPropagation(); onReject(); }}
      title="거절"
    >
      <X size={12} />
    </button>
  </div>
);

export const BlockRenderer = ({ block, previewBlockId }: BlockRendererProps) => {
  const { type, content, id: blockId } = block;
  const id = previewBlockId || blockId;
  
  const { 
    activeBlockId, setActiveBlockId, applyJsonPatch, activePageId, formFactor,
    isReviewMode, pendingPatches, acceptPatch, rejectPatch,
    acceptPatchesByBlockId, rejectPatchesByBlockId
  } = useFormStore();
  const isActive = activeBlockId === id && !isReviewMode;
  
  // Check for block-level changes (entire block add/remove)
  const blockLevelPatch = hasBlockLevelChange(id, pendingPatches);
  const isBlockLevelChange = !!blockLevelPatch;
  
  // Check for field-level changes
  const labelPatch = getPendingPatchForField(id, 'label', pendingPatches);
  const optionPatches = getOptionPatches(id, pendingPatches);
  
  // Any pending changes at all
  const allBlockPatches = getAllPendingPatchesForBlock(id, pendingPatches);
  const hasPendingChange = allBlockPatches.length > 0;

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId);
    const blockIndex = formFactor?.pages[pageIndex ?? 0]?.blocks.findIndex(b => b.id === id);
    
    if (pageIndex !== -1 && blockIndex !== -1) {
      applyJsonPatch([{
        op: 'replace',
        path: `/pages/${pageIndex}/blocks/${blockIndex}/content/label`,
        value: e.target.value
      }]);
    }
  };

  const deleteBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId);
    const blockIndex = formFactor?.pages[pageIndex ?? 0]?.blocks.findIndex(b => b.id === id);
    
    if (pageIndex !== -1 && blockIndex !== -1) {
      applyJsonPatch([{
        op: 'remove',
        path: `/pages/${pageIndex}/blocks/${blockIndex}`
      }]);
    }
  };

  const handleOptionChange = (optionIndex: number, newValue: string) => {
    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId) ?? 0;
    const blockIndex = formFactor?.pages[pageIndex]?.blocks.findIndex(b => b.id === id) ?? 0;
    
    applyJsonPatch([{
      op: 'replace',
      path: `/pages/${pageIndex}/blocks/${blockIndex}/content/options/${optionIndex}`,
      value: newValue
    }]);
  };

  const addOption = () => {
    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId) ?? 0;
    const blockIndex = formFactor?.pages[pageIndex]?.blocks.findIndex(b => b.id === id) ?? 0;
    const currentOptions = content.options || [];
    
    applyJsonPatch([{
      op: 'add',
      path: `/pages/${pageIndex}/blocks/${blockIndex}/content/options/-`,
      value: `옵션 ${currentOptions.length + 1}`
    }]);
  };

  const removeOption = (optionIndex: number) => {
    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId) ?? 0;
    const blockIndex = formFactor?.pages[pageIndex]?.blocks.findIndex(b => b.id === id) ?? 0;
    
    applyJsonPatch([{
      op: 'remove',
      path: `/pages/${pageIndex}/blocks/${blockIndex}/content/options/${optionIndex}`
    }]);
  };

  // Helper to get option patch by index
  const getOptionPatchByIndex = (optionIndex: number): PatchItem | undefined => {
    return optionPatches.find(p => 
      p.targetField === `options/${optionIndex}` || 
      p.targetField === 'options/-'
    );
  };

  const renderInput = () => {
    switch (type) {
      case 'text':
        return (
          <input 
            type="text" 
            placeholder={content.placeholder} 
            className={styles.input}
          />
        );
      case 'textarea':
        return (
          <textarea 
            placeholder={content.placeholder} 
            className={styles.textarea}
          />
        );
      case 'choice':
        return (
          <div className={styles.options}>
            {content.options?.map((opt: string, i: number) => {
              const optPatch = getOptionPatchByIndex(i);
              const hasOptionChange = !!optPatch;
              
              return (
                <div 
                  key={i} 
                  className={`${styles.optionItem} ${hasOptionChange ? styles.optionHasDiff : ''}`}
                  style={hasOptionChange ? {
                    backgroundColor: optPatch.changeType === 'remove' 
                      ? 'rgba(239, 68, 68, 0.12)' 
                      : optPatch.changeType === 'add'
                        ? 'rgba(34, 197, 94, 0.12)'
                        : 'rgba(234, 179, 8, 0.12)',
                    borderRadius: '8px',
                    position: 'relative'
                  } : {}}
                >
                  <input type="radio" disabled />
                  {isActive ? (
                    <div className={styles.optionEditWrapper}>
                      <input
                        className={styles.optionInput}
                        value={opt}
                        onChange={(e) => handleOptionChange(i, e.target.value)}
                      />
                      <button
                        className={styles.removeOptionBtn}
                        onClick={() => removeOption(i)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <span className={styles.optionText}>{opt}</span>
                  )}

                  {/* Field-level diff badge for this option */}
                  {hasOptionChange && (
                    <FieldDiffBadge
                      patch={optPatch}
                      onAccept={() => acceptPatch(optPatch.id)}
                      onReject={() => rejectPatch(optPatch.id)}
                    />
                  )}
                </div>
              );
            })}
            {isActive && (
              <button className={styles.addOptionBtn} onClick={addOption}>
                <Plus size={14} /> 옵션 추가
              </button>
            )}
          </div>
        );
      case 'info':
        return (
          <div className={styles.infoBody}>
            {content.body}
          </div>
        );
      case 'statement':
        return (
          <div className={styles.statementWrapper}>
            {isActive ? (
              <>
                <input 
                  className={styles.statementLabelInput}
                  value={content.label || ''}
                  onChange={handleLabelChange}
                  placeholder="제목을 입력하세요"
                  autoFocus
                />
                <textarea 
                  className={styles.statementBodyInput}
                  value={content.body || ''}
                  onChange={(e) => {
                    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId) ?? 0;
                    const blockIndex = formFactor?.pages[pageIndex]?.blocks.findIndex(b => b.id === id) ?? 0;
                    applyJsonPatch([{
                      op: 'replace',
                      path: `/pages/${pageIndex}/blocks/${blockIndex}/content/body`,
                      value: e.target.value
                    }]);
                  }}
                  placeholder="본문을 입력하세요"
                />
              </>
            ) : (
              <>
                {content.label && (
                  <h1 className={styles.statementLabel}>
                    {content.label}
                  </h1>
                )}
                {content.body && (
                  <p className={styles.statementBody}>
                    {content.body}
                  </p>
                )}
              </>
            )}
          </div>
        );
      default:
        return <div>Unknown block type: {type}</div>;
    }
  };

  // Block-level styling for add/remove entire block
  const getBlockDiffStyle = () => {
    if (!isBlockLevelChange || !blockLevelPatch) return {};
    const colors = {
      add: 'rgba(34, 197, 94, 0.12)',
      remove: 'rgba(239, 68, 68, 0.12)',
      replace: 'rgba(234, 179, 8, 0.12)',
    };
    return { backgroundColor: colors[blockLevelPatch.changeType] };
  };

  return (
    <div 
      className={`${styles.blockContainer} ${isActive ? styles.active : ''} ${isBlockLevelChange ? styles.hasDiff : ''}`}
      style={{
        ...getBlockDiffStyle(),
        ...(type === 'statement' ? { alignItems: 'center', textAlign: 'center' } : {})
      }}
      onClick={(e) => {
        if (isReviewMode) return;
        e.stopPropagation();
        setActiveBlockId(id);
      }}
    >
      {/* Block-level diff badge (only for entire block add/remove) */}
      {isBlockLevelChange && blockLevelPatch && (
        <div className={styles.diffBadge} data-change-type={blockLevelPatch.changeType}>
          <span className={styles.diffLabel}>
            {blockLevelPatch.changeType === 'add' && '문항 추가'}
            {blockLevelPatch.changeType === 'remove' && '문항 삭제'}
          </span>
          <div className={styles.diffActions}>
            <button 
              className={styles.diffAcceptBtn}
              onClick={(e) => {
                e.stopPropagation();
                acceptPatchesByBlockId(id);
              }}
              title="수락"
            >
              <Check size={14} />
            </button>
            <button 
              className={styles.diffRejectBtn}
              onClick={(e) => {
                e.stopPropagation();
                rejectPatchesByBlockId(id);
              }}
              title="거절"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Label with inline diff - Skip for statement block as it handles it internally */}
      {type !== 'statement' && (
        <div 
          className={`${styles.labelWrapper} ${labelPatch ? styles.labelHasDiff : ''}`}
          style={labelPatch ? {
            backgroundColor: labelPatch.changeType === 'replace' 
              ? 'rgba(234, 179, 8, 0.15)' 
              : 'transparent',
            borderRadius: '8px',
            padding: '4px 8px',
            margin: '-4px -8px',
            position: 'relative'
          } : {}}
        >
          {isActive ? (
            <input 
              className={styles.labelInput}
              value={content.label || ''}
              onChange={handleLabelChange}
              placeholder="문항 제목을 입력하세요"
              autoFocus
            />
          ) : (
            content.label && <label className={styles.label}>{content.label}</label>
          )}
          
          {/* Field-level diff badge for label */}
          {labelPatch && (
            <FieldDiffBadge 
              patch={labelPatch}
              onAccept={() => acceptPatch(labelPatch.id)}
              onReject={() => rejectPatch(labelPatch.id)}
            />
          )}
        </div>
      )}
      
      {content.helpText && <p className={styles.helpText}>{content.helpText}</p>}
      
      <div className={styles.inputWrapper}>
        {renderInput()}
      </div>

      {isActive && block.removable !== false && (
        <button className={styles.deleteBtn} onClick={deleteBlock} title="Delete Block">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
};
