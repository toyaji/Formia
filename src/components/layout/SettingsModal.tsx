'use client';

import { useState, useEffect } from 'react';
import { useFormStore } from '@/store/useFormStore';
import styles from './SettingsModal.module.css';
import { useSession } from 'next-auth/react';
import { X, Key, ShieldCheck, Info, Cloud, Clock, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import Link from 'next/link';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal = ({ onClose }: SettingsModalProps) => {
  const { data: session } = useSession();
  const { aiKeyStatus, setAiKeyStatus } = useFormStore();
  const [apiKey, setApiKey] = useState('');
  const [storageMode, setStorageMode] = useState<'session' | 'cloud'>('session');
  const [isSaving, setIsSaving] = useState(false);
  
  const isLoggedIn = !!session?.user;

  const geminiStatus = aiKeyStatus['gemini'] || { active: false, masked: '' };

  useEffect(() => {
    // If user is not logged in and somehow cloud mode was selected, revert to session
    if (!isLoggedIn && storageMode === 'cloud') {
      setStorageMode('session');
    }
  }, [isLoggedIn, storageMode]);

  const handleSave = async () => {
    if (!apiKey) return;
    
    setIsSaving(true);
    try {
      const endpoint = storageMode === 'cloud' ? '/api/secrets' : '/api/secrets/session';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider: 'gemini', 
          apiKey,
          category: 'ai_secret'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiKeyStatus('gemini', { 
          active: true, 
          masked: data.maskedKey || (apiKey.slice(0,3) + '-...' + apiKey.slice(-4)) 
        });
        setApiKey(''); // Clear raw key from state
        onClose();
      } else {
        const error = await response.json();
        alert(`저장 중 오류가 발생했습니다: ${error.error}`);
      }
    } catch (e) {
      console.error('Save secret error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <Key className={styles.icon} size={20} />
            <h2>AI Settings</h2>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <label className={styles.label}>Google Gemini API Key</label>
            <div className={styles.statusBadge + (geminiStatus.active ? '' : ` ${styles.inactive}`)}>
              {geminiStatus.active ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>설정됨 ({geminiStatus.masked})</span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} />
                  <span>키가 설정되지 않았습니다.</span>
                </>
              )}
            </div>
            
            <p className={styles.description}>
              Formia AI 기능을 사용하기 위해 본인의 API 키가 필요합니다.
              입력하신 키는 서버의 안전한 저장소(세션 또는 암호화 DB)에 보관됩니다.
            </p>
            
            <div className={styles.inputWrapper}>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={geminiStatus.active ? "새 키를 입력하여 업데이트..." : "AIza..."}
                className={styles.input}
              />
            </div>
          </section>

          <section className={styles.section}>
            <label className={styles.label}>저장 방식 선택</label>
            <div className={styles.modeToggle}>
              <button 
                type="button"
                className={`${styles.modeBtn} ${storageMode === 'session' ? styles.activeMode : ''}`}
                onClick={() => setStorageMode('session')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Clock size={14} />
                  <span>Session-Only</span>
                </div>
              </button>
              <button 
                type="button"
                className={`${styles.modeBtn} ${storageMode === 'cloud' ? styles.activeMode : ''}`}
                onClick={() => {
                  if (isLoggedIn) {
                    setStorageMode('cloud');
                  }
                }}
                disabled={!isLoggedIn}
                title={!isLoggedIn ? "로그인이 필요한 기능입니다" : ""}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  {isLoggedIn ? <Cloud size={14} /> : <Lock size={14} />}
                  <span>Save to Cloud</span>
                </div>
              </button>
            </div>
            {!isLoggedIn && (
              <div className={styles.loginPrompt}>
                <Info size={14} />
                <span>
                  클라우드 저장을 사용하려면 <Link href="/login" className={styles.loginLink}>로그인</Link>이 필요합니다.
                  게스트 상태에서는 <strong>Session-Only</strong> 방식만 이용 가능합니다.
                </span>
              </div>
            )}
            <p className={styles.description} style={{ marginTop: '4px' }}>
              {storageMode === 'session' 
                ? "브라우저를 닫으면 키가 삭제됩니다. 가장 안전한 방식입니다."
                : "암호화되어 안전하게 보관되며 다른 기기에서도 로그인 시 바로 사용 가능합니다."}
            </p>
          </section>

          <div className={styles.infoBox}>
            <ShieldCheck size={18} />
            <span>키는 암호화되어 관리되며, 실제 AI 호출 목적으로만 서버에서 일회성으로 사용됩니다.</span>
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
          <button 
            onClick={handleSave} 
            className={styles.saveBtn}
            disabled={!apiKey || isSaving}
          >
            {isSaving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
};
