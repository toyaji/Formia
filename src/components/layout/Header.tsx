import { useState } from 'react';
import { useFormStore } from '@/store/useFormStore';
import styles from './Header.module.css';
import { Undo2, Redo2, Save, Play, Settings } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

export const Header = () => {
  const { formFactor, undo, redo, history, future } = useFormStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          <span className={styles.logo}>Formia</span>
          <div className={styles.divider} />
          <span className={styles.title}>{formFactor?.metadata.title}</span>
        </div>

        <div className={styles.center}>
          <button 
            onClick={undo} 
            disabled={history.length === 0}
            className={styles.iconBtn}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={18} />
          </button>
          <button 
            onClick={redo} 
            disabled={future.length === 0}
            className={styles.iconBtn}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={18} />
          </button>
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
