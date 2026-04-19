'use client';

import { useState } from 'react';
import styles from './PublishModal.module.css';
import { X, Copy, Check, ExternalLink, Globe, Send } from 'lucide-react';

interface PublishModalProps {
  onClose: () => void;
  shortId: string;
}

/**
 * PublishModal
 * 설문 배포 성공 시 나타나는 모달로, 생성된 URL을 확인하고 복사할 수 있습니다.
 */
export const PublishModal = ({ onClose, shortId }: PublishModalProps) => {
  const [copied, setCopied] = useState(false);
  
  // 브라우저 환경에서 현재 호스트를 포함한 전체 URL 생성
  const publishUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}/p/${shortId}` 
    : `/p/${shortId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publishUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <div className={styles.iconCircle}>
              <Send size={20} className={styles.icon} />
            </div>
            <h2 className={styles.title}>설문지가 배포되었습니다.</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>
            이제 아래 링크를 통해 누구나 설문에 참여할 수 있습니다.<br />
            SNS, 메일, 메신저 등에 공유해 보세요.
          </p>

          <div className={styles.urlBox}>
            <div className={styles.urlText}>{publishUrl}</div>
            <button className={`${styles.copyBtn} ${copied ? styles.copied : ''}`} onClick={handleCopy}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
              <span>{copied ? '복사됨' : '링크 복사'}</span>
            </button>
          </div>

          <div className={styles.actionGroup}>
            <a 
              href={publishUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={styles.viewBtn}
            >
              <ExternalLink size={18} /> 배포 페이지 방문하기
            </a>
          </div>
        </div>
        
        <div className={styles.footer}>
          <div className={styles.info}>
            <Globe size={14} /> <span>전체 공개 상태</span>
          </div>
          <button className={styles.doneBtn} onClick={onClose}>완료</button>
        </div>
      </div>
    </div>
  );
};
