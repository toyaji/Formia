import { FormBlock, BlockTypeSchema } from '@/lib/core/schema';
import styles from './BlockRenderer.module.css';
import { useFormStore, PatchItem } from '@/store/useFormStore';
import { Trash2, Plus, X, Check, GripVertical, ChevronDown, Copy, PlusCircle, FilePlus } from 'lucide-react';
import { 
  hasBlockLevelChange, 
  getPendingPatchForField,
  getOptionPatches,
  getAllPendingPatchesForBlock 
} from '@/lib/utils/patchUtils';
import { BLOCK_METADATA } from '@/lib/constants/blocks';

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
    acceptPatchesByBlockId, rejectPatchesByBlockId, setActivePageId
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

  const copyBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId) ?? 0;
    const blockIndex = formFactor?.pages[pageIndex]?.blocks.findIndex(b => b.id === id) ?? 0;
    
    const newBlock = { ...block, id: Math.random().toString(36).substring(7) };
    applyJsonPatch([{
      op: 'add',
      path: `/pages/${pageIndex}/blocks/${blockIndex + 1}`,
      value: newBlock
    }]);
  };

  const toggleRequired = () => {
    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId) ?? 0;
    const blockIndex = formFactor?.pages[pageIndex]?.blocks.findIndex(b => b.id === id) ?? 0;
    const currentValue = block.validation?.required || false;
    
    applyJsonPatch([{
      op: 'replace',
      path: `/pages/${pageIndex}/blocks/${blockIndex}/validation/required`,
      value: !currentValue
    }]);
  };

  const updateType = (newType: string) => {
    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId) ?? 0;
    const blockIndex = formFactor?.pages[pageIndex]?.blocks.findIndex(b => b.id === id) ?? 0;
    
    applyJsonPatch([{
      op: 'replace',
      path: `/pages/${pageIndex}/blocks/${blockIndex}/type`,
      value: newType
    }]);
  };

  const splitPage = () => {
    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId) ?? 0;
    const blockIndex = formFactor?.pages[pageIndex]?.blocks.findIndex(b => b.id === id) ?? 0;
    
    if (!formFactor) return;

    const currentPage = formFactor.pages[pageIndex];
    const upperBlocks = currentPage.blocks.slice(0, blockIndex + 1);
    const lowerBlocks = currentPage.blocks.slice(blockIndex + 1);

    const newPage = {
      id: Math.random().toString(36).substring(7),
      type: 'default' as const,
      title: '새 페이지',
      blocks: lowerBlocks,
    };

    applyJsonPatch([
      { op: 'replace', path: `/pages/${pageIndex}/blocks`, value: upperBlocks },
      { op: 'add', path: `/pages/${pageIndex + 1}`, value: newPage }
    ]);
  };

  const handleHelpTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId) ?? 0;
    const blockIndex = formFactor?.pages[pageIndex]?.blocks.findIndex(b => b.id === id) ?? 0;
    
    applyJsonPatch([{
      op: 'replace',
      path: `/pages/${pageIndex}/blocks/${blockIndex}/content/helpText`,
      value: e.target.value
    }]);
  };

  const toggleMultiSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId) ?? 0;
    const blockIndex = formFactor?.pages[pageIndex]?.blocks.findIndex(b => b.id === id) ?? 0;
    const currentValue = content.multiSelect || false;
    const hasField = content.multiSelect !== undefined;
    
    applyJsonPatch([{
      op: hasField ? 'replace' : 'add',
      path: `/pages/${pageIndex}/blocks/${blockIndex}/content/multiSelect`,
      value: !currentValue
    }]);
  };

  const toggleAllowOther = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId) ?? 0;
    const blockIndex = formFactor?.pages[pageIndex]?.blocks.findIndex(b => b.id === id) ?? 0;
    const currentValue = content.allowOther || false;
    const hasField = content.allowOther !== undefined;
    
    applyJsonPatch([{
      op: hasField ? 'replace' : 'add',
      path: `/pages/${pageIndex}/blocks/${blockIndex}/content/allowOther`,
      value: !currentValue
    }]);
  };

  const addPage = () => {
    if (!formFactor) return;
    const pageIndex = formFactor.pages.findIndex(p => p.id === activePageId);
    const questionPages = formFactor.pages.filter(p => !p.type || p.type === 'default');
    
    const newPage = {
      id: Math.random().toString(36).substring(7),
      type: 'default' as const,
      title: `${questionPages.length + 1}페이지`,
      blocks: [],
    };

    applyJsonPatch([{
      op: 'add',
      path: `/pages/${pageIndex + 1}`,
      value: newPage
    }]);
  };

  const addNewBlock = () => {
    const pageIndex = formFactor?.pages.findIndex(p => p.id === activePageId) ?? 0;
    const blockIndex = formFactor?.pages[pageIndex]?.blocks.findIndex(b => b.id === id) ?? 0;
    
    const newBlock = {
      id: Math.random().toString(36).substring(7),
      type: 'text' as const,
      content: { label: '', placeholder: '응답을 입력해 주세요.' },
      validation: { required: false },
    };

    applyJsonPatch([{
      op: 'add',
      path: `/pages/${pageIndex}/blocks/${blockIndex + 1}`,
      value: newBlock
    }]);
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
                  className={`${styles.optionItem} ${hasOptionChange ? styles.optionHasDiff : ''} ${isActive ? styles.optionItemActive : ''}`}
                >
                  {isActive && (
                    <div className={styles.optionHandle}>
                      <GripVertical size={14} />
                    </div>
                  )}
                  <input 
                    type={content.multiSelect ? 'checkbox' : 'radio'} 
                    disabled 
                    className={content.multiSelect ? styles.checkboxPlaceholder : styles.radioPlaceholder} 
                  />
                  {isActive ? (
                    <div className={styles.optionEditWrapper}>
                      <input
                        className={styles.optionInput}
                        value={opt}
                        onChange={(e) => handleOptionChange(i, e.target.value)}
                        placeholder={`옵션 ${i + 1}`}
                      />
                      <button
                        className={styles.removeOptionBtn}
                        onClick={() => removeOption(i)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <span className={styles.optionText}>{opt}</span>
                  )}
                </div>
              );
            })}
            {/* 기타 옵션 표시 */}
            {content.allowOther && (
              <div className={`${styles.optionItem} ${isActive ? styles.optionItemActive : ''}`}>
                {isActive && (
                  <div className={styles.optionHandle}>
                    <GripVertical size={14} />
                  </div>
                )}
                <input 
                  type={content.multiSelect ? 'checkbox' : 'radio'} 
                  disabled 
                  className={content.multiSelect ? styles.checkboxPlaceholder : styles.radioPlaceholder} 
                />
                {isActive ? (
                  <div className={styles.optionEditWrapper}>
                    <span className={styles.optionText} style={{ color: '#9CA3AF', flex: 1 }}>기타 (직접 입력)</span>
                    <button
                      className={styles.removeOptionBtn}
                      onClick={toggleAllowOther}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <span className={styles.optionText} style={{ color: '#9CA3AF' }}>기타 (직접 입력)</span>
                )}
              </div>
            )}

            {isActive && (
              <div className={styles.optionActions}>
                <button className={styles.addOptionBtn} onClick={addOption}>
                  <PlusCircle size={14} /> 답변 추가
                </button>
                {!content.allowOther && (
                  <button className={styles.addOtherBtn} onClick={toggleAllowOther}>
                    <PlusCircle size={14} /> 기타 추가
                  </button>
                )}
              </div>
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
                    // Auto-resize textarea
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onFocus={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  placeholder="본문을 입력하세요"
                  rows={1}
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
        return (
          <div className={styles.unknownBlock}>
            <p>지원하지 않는 블록 타입입니다: <strong>{type}</strong></p>
            <p className={styles.unknownBlockHint}>
              지원되는 타입: {BlockTypeSchema.options.filter(t => !['statement', 'info'].includes(t)).join(', ')}
            </p>
          </div>
        );
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
      className={`${styles.blockContainer} ${isActive ? styles.active : ''} ${isBlockLevelChange ? styles.hasDiff : ''} ${type === 'statement' ? styles.statementBlock : ''}`}
      style={{
        ...getBlockDiffStyle(),
        ...(type === 'statement' ? { alignItems: 'center', textAlign: 'center' } : {})
      }}
      onClick={(e) => {
        if (isReviewMode) return;
        e.stopPropagation();
        // Find which page this block belongs to and switch to it
        const blockPage = formFactor?.pages.find(p => p.blocks.some(b => b.id === id));
        if (blockPage && blockPage.id !== activePageId) {
          setActivePageId(blockPage.id);
        }
        setActiveBlockId(id);
      }}
    >
      {isActive && type !== 'statement' && (
        <div className={styles.topBar}>
          <div className={styles.typeSelector}>
            <span className={styles.typeIcon}>
              {BLOCK_METADATA[type]?.icon || 'T'}
            </span>
            <span className={styles.typeLabel}>
              {BLOCK_METADATA[type]?.label || '항목'}
            </span>
            <ChevronDown size={14} className={styles.chevron} />
          </div>
          <div className={styles.dragHandle}>
            <GripVertical size={16} />
            <GripVertical size={16} style={{ marginLeft: '-10px' }} />
          </div>
          <div className={styles.topBarRight} />
        </div>
      )}

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
        >
          {isActive ? (
            <div className={styles.labelEditContainer}>
              <span className={styles.requiredMark}>{block.validation?.required ? '*' : ''}</span>
              <input 
                className={styles.labelInput}
                value={content.label || ''}
                onChange={handleLabelChange}
                placeholder="질문을 입력해 주세요."
                autoFocus
              />
            </div>
          ) : (
            <label className={styles.label}>
              {block.validation?.required && <span className={styles.requiredMark}>*</span>}
              {content.label || '제목 없음'}
            </label>
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
      
      {type !== 'statement' && (
        isActive ? (
          <input 
            className={styles.helpTextInput}
            value={content.helpText || ''}
            onChange={handleHelpTextChange}
            placeholder="설명을 입력해 주세요."
          />
        ) : (
          content.helpText && <p className={styles.helpText}>{content.helpText}</p>
        )
      )}

      
      <div className={styles.inputWrapper}>
        {renderInput()}
      </div>

      {isActive && type !== 'statement' && (
        <>
          <div className={styles.settingsBar}>
            <div className={styles.toggleGroup}>
              <span className={styles.toggleLabel}>답변 필수</span>
              <div 
                className={`${styles.toggle} ${block.validation?.required ? styles.toggleOn : ''}`}
                onClick={toggleRequired}
              >
                <div className={styles.toggleHandle} />
              </div>
            </div>
            
            {type === 'choice' && (
              <div className={styles.toggleGroup}>
                <span className={styles.toggleLabel}>복수 선택</span>
                <div 
                  className={`${styles.toggle} ${content.multiSelect ? styles.toggleOn : ''}`}
                  onClick={toggleMultiSelect}
                >
                  <div className={styles.toggleHandle} />
                </div>
              </div>
            )}

            <div className={styles.flexSpacer} />

            <div className={styles.actionButtons}>
              <button 
                className={styles.iconBtn} 
                onClick={copyBlock}
                title="복제"
              >
                <Copy size={18} />
              </button>
              <button 
                className={styles.iconBtn} 
                onClick={deleteBlock}
                title="삭제"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          <div className={styles.floatingActions}>
            <button className={styles.floatingAddBtn} onClick={addNewBlock}>
              <Plus size={16} /> 항목 추가
            </button>
            <div className={styles.separator} />
            <button className={styles.floatingSplitBtn} onClick={addPage}>
              <FilePlus size={16} /> 페이지 추가
            </button>
          </div>
        </>
      )}
    </div>
  );
};
