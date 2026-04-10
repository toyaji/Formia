'use client';

import { useState } from 'react';
import { useFormStore, PatchItem } from '@/store/useFormStore';
import { Code2, ChevronDown, ChevronRight } from 'lucide-react';
import styles from './PatchDebugger.module.css';

export const PatchDebugger = () => {
  const { pendingPatches, isReviewMode } = useFormStore();
  const [isOpen, setIsOpen] = useState(false);

  if (!isReviewMode || pendingPatches.length === 0) {
    return null;
  }

  const handleToggle = () => setIsOpen(!isOpen);

  return (
    <div className={styles.debuggerContainer}>
      <button 
        className={styles.toggleButton} 
        onClick={handleToggle}
        title="View raw JSON patches"
      >
        <span className={styles.leftGroup}>
          <Code2 size={16} />
          <span>개발자 도구 (JSON Array 보기)</span>
        </span>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {isOpen && (
        <div className={styles.panel}>
          <p className={styles.instruction}>아래는 AI가 폼 구조를 변경하기 위해 제안한 원본 JSON Patch (RFC 6902) 배열입니다.</p>
          <div className={styles.patchList}>
            {pendingPatches.map((p: PatchItem, idx: number) => (
              <div 
                key={p.id} 
                className={`${styles.patchItem} ${
                  p.status === 'accepted' ? styles.statusAccepted : 
                  p.status === 'rejected' ? styles.statusRejected : styles.statusPending
                }`}
              >
                <div className={styles.patchHeader}>
                  <span className={styles.badgeOp} data-op={p.patch.op}>{p.patch.op}</span>
                  <span className={styles.badgeStatus}>{p.status}</span>
                </div>
                <div className={styles.codeBlock}>
                  <pre>
                    <code>{JSON.stringify(p.patch, null, 2)}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
