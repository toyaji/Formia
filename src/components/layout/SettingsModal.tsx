'use client';

import { useState, useEffect } from 'react';
import { useFormStore } from '@/store/useFormStore';
import styles from './SettingsModal.module.css';
import { useSession } from 'next-auth/react';
import { X, Key, ShieldCheck, Info, Cloud, Clock, AlertCircle, CheckCircle2, Lock, ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal = ({ onClose }: SettingsModalProps) => {
  const { data: session } = useSession();
  const { aiKeyStatus, setAiKeyStatus, config, setConfig } = useFormStore();
  const [view, setView] = useState<'list' | 'details'>('list');
  const [apiKey, setApiKey] = useState('');
  const [storageMode, setStorageMode] = useState<'session' | 'cloud'>('session');
  const [isSaving, setIsSaving] = useState(false);
  const [isEvicting, setIsEvicting] = useState(false);
  
  const selectedProvider = config.activeAiProvider || 'gemini';
  const isLoggedIn = !!session?.user;

  const currentStatus = aiKeyStatus[selectedProvider] || { active: false, masked: '' };

  useEffect(() => {
    // If user is not logged in and somehow cloud mode was selected, revert to session
    if (!isLoggedIn && storageMode === 'cloud') {
      setStorageMode('session');
    }
  }, [isLoggedIn, storageMode]);

  const handleEvict = async () => {
    if (!confirm(`정말로 저장된 ${selectedProvider} API 키를 삭제하시겠습니까?`)) return;
    
    setIsEvicting(true);
    try {
      // Evict from both session and cloud to be sure
      const sessionPromise = fetch('/api/secrets/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider })
      });
      
      const dbPromise = isLoggedIn ? fetch('/api/secrets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider })
      }) : Promise.resolve({ ok: true });

      const [sessionRes, dbRes] = await Promise.all([sessionPromise, dbPromise]);

      if (sessionRes.ok && dbRes.ok) {
        setAiKeyStatus(selectedProvider, { active: false, masked: '' });
      } else {
        alert('키 삭제 중 오류가 발생했습니다.');
      }
    } catch (e) {
      console.error('Evict secret error:', e);
    } finally {
      setIsEvicting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey) return;
    
    setIsSaving(true);
    try {
      const endpoint = storageMode === 'cloud' ? '/api/secrets' : '/api/secrets/session';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider: selectedProvider, 
          apiKey,
          category: 'ai_secret'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiKeyStatus(selectedProvider, { 
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

  const providers = [
    { id: 'gemini', name: 'Gemini', icon: <img src="/images/logos/gemini.svg" alt="Gemini" width={32} height={32} />, helpUrl: 'https://aistudio.google.com/app/apikey' },
    { id: 'openai', name: 'OpenAI', icon: <img src="/images/logos/openai.svg" alt="OpenAI" width={32} height={32} />, helpUrl: 'https://platform.openai.com/api-keys' },
  ];

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            {view === 'details' ? (
              <button onClick={() => setView('list')} className={styles.backBtn}>
                <ArrowLeft size={18} />
                <span>뒤로</span>
              </button>
            ) : (
              <>
                <Key className={styles.icon} size={20} />
                <h2>AI 설정</h2>
              </>
            )}
          </div>
          <div className={styles.headerRight}>
            {view === 'details' && <h2 style={{ fontSize: '1.1rem', marginRight: '16px' }}>{providers.find(p => p.id === selectedProvider)?.name} 설정</h2>}
            <button onClick={onClose} className={styles.closeBtn}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {view === 'list' ? (
            <div className={styles.viewContainer}>
              <p className={styles.listDescription}>사용하실 AI 제공자를 선택해주세요.</p>
              <div className={styles.providerGrid}>
                {providers.map((p) => {
                  const status = aiKeyStatus[p.id];
                  const isActive = selectedProvider === p.id;
                  return (
                    <button
                      key={p.id}
                      className={`${styles.providerBtn} ${isActive ? styles.activeProvider : ''}`}
                      onClick={() => {
                        setConfig({ activeAiProvider: p.id });
                        setView('details');
                      }}
                    >
                      <div className={styles.providerIconWrapper}>
                        <div className={styles.providerIcon}>{p.icon}</div>
                        {status?.active && (
                          <div className={styles.statusIndicator}>
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <span className={styles.providerName}>{p.name}</span>
                      <span className={styles.providerStatus}>
                        {status?.active ? '설정됨' : '미설정'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={styles.viewContainer}>
              <section className={styles.section}>
                <label className={styles.label}>{selectedProvider === 'openai' ? 'OpenAI' : 'Google Gemini'} API Key</label>
                <div className={styles.statusGroup}>
                  <div className={styles.statusBadge + (currentStatus.active ? '' : ` ${styles.inactive}`)}>
                    {currentStatus.active ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>설정됨 ({currentStatus.masked})</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={14} />
                        <span>키가 설정되지 않았습니다.</span>
                      </>
                    )}
                  </div>
                  {currentStatus.active && (
                    <button 
                      className={styles.evictBtn}
                      onClick={handleEvict}
                      disabled={isEvicting}
                    >
                      {isEvicting ? '삭제 중...' : '삭제'}
                    </button>
                  )}
                </div>
                
                <p className={styles.description}>
                  {selectedProvider === 'openai' ? 'ChatGPT' : 'Gemini'} 기능을 사용하기 위해 본인의 API 키가 필요합니다.
                  입력하신 키는 서버의 안전한 저장소에 보관됩니다.
                </p>
                
                <div className={styles.inputWrapper}>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={currentStatus.active ? "새 키를 입력하여 업데이트..." : (selectedProvider === 'openai' ? "sk-..." : "AIza...")}
                    className={styles.input}
                    autoFocus
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
                    className={`${styles.modeBtn} ${storageMode === 'cloud' ? styles.activeMode : ''} ${!isLoggedIn ? 'f-tooltip-container' : ''}`}
                    onClick={() => {
                      if (isLoggedIn) {
                        setStorageMode('cloud');
                      }
                    }}
                    disabled={!isLoggedIn}
                    data-tooltip={!isLoggedIn ? "로그인이 필요한 기능입니다" : ""}
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
                  href={providers.find(p => p.id === selectedProvider)?.helpUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  여기에서 {selectedProvider === 'openai' ? 'OpenAI' : 'Gemini'} API 키를 발급받을 수 있습니다.
                </a>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {view === 'list' ? (
             <button onClick={onClose} className={styles.saveBtn}>확인</button>
          ) : (
            <>
              <button onClick={() => setView('list')} className={styles.cancelBtn}>취소</button>
              <button 
                onClick={handleSave} 
                className={styles.saveBtn}
                disabled={!apiKey || isSaving}
              >
                {isSaving ? '저장 중...' : '저장하기'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
