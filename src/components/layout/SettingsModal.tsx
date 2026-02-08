'use client';

import { useState } from 'react';
import { useFormStore } from '@/store/useFormStore';
import styles from './SettingsModal.module.css';
import { X, Key, ShieldCheck, Info } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal = ({ onClose }: SettingsModalProps) => {
  const { config, setConfig } = useFormStore();
  const [apiKey, setApiKey] = useState(config.geminiApiKey || '');

  const handleSave = () => {
    setConfig({ geminiApiKey: apiKey });
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <Key className={styles.icon} size={20} />
            <h2>Settings</h2>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <label className={styles.label}>Gemini API Key</label>
            <p className={styles.description}>
              Formia AI를 사용하기 위해 Google Gemini API 키가 필요합니다. 
              입력하신 키는 사용자의 브라우저(로컬)에만 안전하게 저장됩니다.
            </p>
            <div className={styles.inputWrapper}>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                className={styles.input}
              />
            </div>
          </section>

          <div className={styles.infoBox}>
            <ShieldCheck size={18} />
            <span>키는 암호화되어 로컬 스토리지에 보관되며 서버로 전송되지 않습니다.</span>
          </div>

          <div className={styles.byokInfo}>
            <Info size={16} />
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              여기에서 Gemini API 키를 발급받을 수 있습니다.
            </a>
          </div>
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.cancelBtn}>취소</button>
          <button onClick={handleSave} className={styles.saveBtn}>저장하기</button>
        </div>
      </div>
    </div>
  );
};
