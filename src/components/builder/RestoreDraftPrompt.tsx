import React from 'react';
import { useFormStore } from '@/store/useFormStore';
import { RotateCcw, Plus, AlertCircle, History } from 'lucide-react';
import styles from './RestoreDraftPrompt.module.css';

export const RestoreDraftPrompt: React.FC = () => {
  const { hasDraftOnStartup, restoreLastDraft, discardDraft, formFactor } = useFormStore();

  if (!hasDraftOnStartup) return null;

  const draftTitle = formFactor?.metadata?.title || '제목 없는 폼';
  const lastUpdated = formFactor?.metadata?.updatedAt 
    ? new Date(formFactor.metadata.updatedAt).toLocaleString() 
    : '최근 작업';

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <div className={styles.iconWrapper}>
          <History className={styles.icon} size={24} />
        </div>
        
        <div className={styles.content}>
          <h3 className={styles.title}>이어서 작업하시겠습니까?</h3>
          <p className={styles.description}>
            최근 브라우저에 저장된 작업 내용이 있습니다: 
            <span className={styles.draftInfo}> "{draftTitle}" ({lastUpdated})</span>
          </p>
        </div>

        <div className={styles.actions}>
          <button className={styles.discardBtn} onClick={discardDraft}>
            <Plus size={18} />
            <span>새로 시작</span>
          </button>
          <button className={styles.restoreBtn} onClick={restoreLastDraft}>
            <RotateCcw size={18} />
            <span>이어서 하기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
