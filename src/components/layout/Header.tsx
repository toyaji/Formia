import { useState } from 'react';
import { useFormStore } from '@/store/useFormStore';
import styles from './Header.module.css';
import { Undo2, Redo2, Save, Play, Settings, Monitor, Smartphone, Cloud, FileCode, Check, RefreshCw, AlertCircle, Info } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

import { UserAvatar } from './UserAvatar';

export const Header = () => {
  const { 
    formFactor, viewport, setViewport, history, future, undo, redo, applyJsonPatch,
    saveStatus, session, syncWithPersistence
  } = useFormStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(formFactor?.metadata.title || '');

  const isTauri = typeof window !== 'undefined' && ((window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined);

  const handleTitleSubmit = () => {
    const newTitle = editTitle.trim() || '제목 없는 설문지';
    applyJsonPatch([{
      op: 'replace',
      path: '/metadata/title',
      value: newTitle
    }]);
    setEditTitle(newTitle);
    setIsEditingTitle(false);
  };

  const renderSaveStatus = () => {
    const isCloud = !!session?.user?.id;
    const StorageIcon = isCloud ? Cloud : (isTauri ? FileCode : Info);
    const storageText = isCloud ? 'Cloud' : (isTauri ? 'Local' : 'Draft');

    if (saveStatus === 'saving') {
      return (
        <div className={`${styles.saveStatus} ${styles.saving}`}>
          <RefreshCw size={14} className={styles.rotating} />
          <span>Saving to {storageText}...</span>
        </div>
      );
    }
    if (saveStatus === 'saved') {
      return (
        <div className={`${styles.saveStatus} ${styles.saved}`}>
          <Check size={14} />
          <span>Saved to {storageText}</span>
        </div>
      );
    }
    if (saveStatus === 'error') {
      return (
        <div className={`${styles.saveStatus} ${styles.error}`} onClick={() => syncWithPersistence()}>
          <AlertCircle size={14} />
          <span>Save Error (Retry)</span>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          <span className={styles.logo}>Formia</span>
          <div className={styles.divider} />
          {isEditingTitle ? (
            <input 
              className={styles.titleInput}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') {
                  setEditTitle(formFactor?.metadata.title || '');
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
            />
          ) : (
            <span 
              className={styles.title} 
              onDoubleClick={() => {
                setEditTitle(formFactor?.metadata.title || '');
                setIsEditingTitle(true);
              }}
              title="더블 클릭하여 제목 수정"
            >
              {formFactor?.metadata.title}
            </span>
          )}
          <div className={styles.divider} />
          
          <div className={styles.historyGroup}>
            <button 
              onClick={undo} 
              disabled={history.length === 0} 
              className={styles.historyBtn} 
              title="실행 취소 (Undo)"
            >
              <Undo2 size={16} />
            </button>
            <button 
              onClick={redo} 
              disabled={future.length === 0} 
              className={styles.historyBtn} 
              title="다시 실행 (Redo)"
            >
              <Redo2 size={16} />
            </button>
          </div>
        </div>

        <div className={styles.center}>
          <div className={styles.viewportToggle}>
            <button 
              className={`${styles.viewportBtn} ${viewport === 'desktop' ? styles.active : ''}`}
              onClick={() => setViewport('desktop')}
              title="Desktop View"
            >
              <Monitor size={18} />
            </button>
            <button 
              className={`${styles.viewportBtn} ${viewport === 'mobile' ? styles.active : ''}`}
              onClick={() => setViewport('mobile')}
              title="Mobile View"
            >
              <Smartphone size={18} />
            </button>
          </div>
        </div>

        <div className={styles.right}>
          {renderSaveStatus()}
          
          <button 
            className={styles.iconBtn} 
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <button className={styles.secondaryBtn}>
            <Play size={16} /> Preview
          </button>
          <div className={styles.divider} />
          <UserAvatar />
        </div>
      </header>

      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </>
  );
};
