import { useState } from 'react';
import { useFormStore } from '@/store/useFormStore';
import styles from './Header.module.css';
import { Undo2, Redo2, Save, Play, Settings, Monitor, Smartphone } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

export const Header = () => {
  const { formFactor, viewport, setViewport, history, future, undo, redo } = useFormStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          <span className={styles.logo}>Formia</span>
          <div className={styles.divider} />
          <span className={styles.title}>{formFactor?.metadata.title}</span>
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
        </div>
      </header>

      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </>
  );
};
