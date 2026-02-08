import { useFormStore } from '@/store/useFormStore';
import styles from './Sidebar.module.css';
import { FormBlock } from '@/lib/core/schema';

export const Sidebar = () => {
  const { formFactor } = useFormStore();

  return (
    <div className={styles.sidebarContent}>
      <div className={styles.sectionHeader}>Blocks</div>
      <div className={styles.blockList}>
        {formFactor?.blocks.map((block: FormBlock) => (
          <div key={block.id} className={styles.blockItem}>
            <span className={styles.blockIcon}>
              {block.type === 'text' && 'T'}
              {block.type === 'choice' && 'C'}
              {block.type === 'info' && 'i'}
            </span>
            <span className={styles.blockLabel}>
              {block.content.label || block.type}
            </span>
          </div>
        ))}
        {formFactor?.blocks.length === 0 && (
          <div className={styles.empty}>No blocks yet</div>
        )}
      </div>
    </div>
  );
};
