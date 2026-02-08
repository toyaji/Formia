import { FormBlock } from '@/lib/core/schema';
import styles from './BlockRenderer.module.css';
import { useFormStore } from '@/store/useFormStore';
import { Trash2, Plus, X } from 'lucide-react';

interface BlockRendererProps {
  block: FormBlock;
}

export const BlockRenderer = ({ block }: BlockRendererProps) => {
  const { type, content, id } = block;
  const { activeBlockId, setActiveBlockId, applyJsonPatch, activePageId, formFactor } = useFormStore();
  const isActive = activeBlockId === id;

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
            {content.options?.map((opt: string, i: number) => (
              <div key={i} className={styles.optionItem}>
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
              </div>
            ))}
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
      default:
        return <div>Unknown block type: {type}</div>;
    }
  };

  return (
    <div 
      className={`${styles.blockContainer} ${isActive ? styles.active : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        setActiveBlockId(id);
      }}
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
      
      {content.helpText && <p className={styles.helpText}>{content.helpText}</p>}
      
      <div className={styles.inputWrapper}>
        {renderInput()}
      </div>

      {isActive && (
        <button className={styles.deleteBtn} onClick={deleteBlock} title="Delete Block">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
};
