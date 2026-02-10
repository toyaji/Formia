import { useState } from 'react';
import { useFormStore } from '@/store/useFormStore';
import styles from './Header.module.css';
import { Undo2, Redo2, Save, Play, Settings, Monitor, Smartphone } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

import { UserAvatar } from './UserAvatar';

export const Header = () => {
  const { formFactor, viewport, setViewport, history, future, undo, redo, applyJsonPatch } = useFormStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(formFactor?.metadata.title || '');

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
          <button className={styles.primaryBtn}>
            <Save size={16} /> Save
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
