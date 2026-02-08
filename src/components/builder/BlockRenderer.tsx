import { FormBlock } from '@/lib/core/schema';
import styles from './BlockRenderer.module.css';

interface BlockRendererProps {
  block: FormBlock;
}

export const BlockRenderer = ({ block }: BlockRendererProps) => {
  const { type, content } = block;

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
              <label key={i} className={styles.optionLabel}>
                <input type="radio" name={block.id} />
                <span>{opt}</span>
              </label>
            ))}
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
    <div className={styles.blockContainer}>
      {content.label && <label className={styles.label}>{content.label}</label>}
      {content.helpText && <p className={styles.helpText}>{content.helpText}</p>}
      <div className={styles.inputWrapper}>
        {renderInput()}
      </div>
    </div>
  );
};
