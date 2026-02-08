'use client';

import { useState, useRef, useEffect } from 'react';
import { useFormStore, Message, PatchItem } from '@/store/useFormStore';
import { useAIPatch } from '@/hooks/useAIPatch';
import styles from './AiPanel.module.css';
import { Send, Trash2, Bot, User, Loader2, Check, X, AlertCircle } from 'lucide-react';
import { convertOperationsToPatchItems } from '@/lib/utils/patchUtils';

const ProposedChanges = () => {
  const { 
    pendingPatches, acceptAllPatches, rejectAllPatches, 
    isReviewMode, addMessage 
  } = useFormStore();

  if (!isReviewMode || pendingPatches.length === 0) return null;

  const pendingCount = pendingPatches.filter((p: PatchItem) => p.status === 'pending').length;
  const totalCount = pendingPatches.length;
  const acceptedCount = pendingPatches.filter((p: PatchItem) => p.status === 'accepted').length;

  const handleApplyAll = () => {
    acceptAllPatches();
    addMessage({
      role: 'assistant',
      content: `모든 변경 사항(${totalCount}개)이 적용되었습니다.`,
    });
  };

  const handleCancelAll = () => {
    rejectAllPatches();
    addMessage({
      role: 'assistant',
      content: '변경 사항이 취소되었습니다.',
    });
  };

  return (
    <div className={styles.proposedCard}>
      <div className={styles.proposedTitle}>
        <Check size={16} />
        <span>변경 제안 수락 준비 완료</span>
      </div>
      <p className={styles.proposedDesc}>
        {pendingCount > 0 ? (
          <>{totalCount}개 중 {pendingCount}개 미처리. 캔버스에서 개별 확인하거나 아래에서 전체 적용하세요.</>
        ) : (
          <>모든 변경 사항이 처리되었습니다. ({acceptedCount}개 수락)</>
        )}
      </p>
      {pendingCount > 0 && (
        <div className={styles.proposedActions}>
          <button onClick={handleApplyAll} className={styles.acceptBtn}>
            <Check size={16} /> 전체 적용
          </button>
          <button onClick={handleCancelAll} className={styles.cancelBtn}>
            <X size={16} /> 전체 취소
          </button>
        </div>
      )}
    </div>
  );
};

export const AiPanel = () => {
  const { 
    messages, addMessage, clearMessages, config, formFactor,
    saveSnapshot, setReviewMode, setPendingPatches, setActiveBlockId
  } = useFormStore();
  const { generatePatch, isLoading } = useAIPatch();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!config.geminiApiKey) {
      addMessage({
        role: 'system_error',
        content: 'Gemini API 키가 설정되지 않았습니다. 설정에서 키를 먼저 등록해주세요.',
      });
      return;
    }

    const userQuery = input;
    setInput('');

    // Add user message
    addMessage({
      role: 'user',
      content: userQuery,
    });

    const patches = await generatePatch(userQuery);

    if (patches && patches.length > 0 && formFactor) {
      // Save current state before review
      saveSnapshot();
      
      // Clear any active editing
      setActiveBlockId(null);
      
      // Convert to PatchItems and enter review mode
      const patchItems = convertOperationsToPatchItems(patches, formFactor);
      setPendingPatches(patchItems);
      setReviewMode(true);
      
      addMessage({
        role: 'assistant',
        content: `${patches.length}개의 변경 사항이 제안되었습니다. 캔버스에서 각 변경을 확인하고 수락/거절하세요.`,
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <Bot className={styles.botIcon} size={20} />
          <span className={styles.title}>Formia AI</span>
        </div>
        <button 
          onClick={clearMessages} 
          className={styles.clearBtn}
          title="대화 내역 지우기"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Message List */}
      <div className={styles.messageList}>
        {!config.geminiApiKey && (
          <div className={`${styles.systemMessage} ${styles.info}`}>
            <AlertCircle size={14} />
            <span>AI 기능을 사용하려면 상단 설정(⚙️)에서 Gemini API 키를 등록해주세요.</span>
          </div>
        )}
        
        {messages.map((m: Message) => {
          const isSystem = m.role === 'system_error' || m.role === 'system_info';
          
          if (isSystem) {
            return (
              <div key={m.id} className={`${styles.systemMessage} ${m.role === 'system_error' ? styles.error : styles.info}`}>
                <AlertCircle size={14} />
                <span>{m.content}</span>
              </div>
            );
          }

          return (
            <div 
              key={m.id} 
              className={`${styles.messageWrapper} ${m.role === 'user' ? styles.user : styles.assistant}`}
            >
              <div className={styles.avatar}>
                {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={styles.messageBubble}>
                {m.content}
              </div>
            </div>
          );
        })}
        
        <ProposedChanges />
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <textarea
            className={styles.textarea}
            placeholder="여기에 요청하세요 (예: '연령대 선택 필드 추가해줘')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            rows={2}
          />
          <button 
            onClick={handleSend} 
            className={styles.sendBtn}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? <Loader2 size={18} className={styles.spin} /> : <Send size={18} />}
          </button>
        </div>
        <p className={styles.hint}>Shift + Enter로 줄바꿈</p>
      </div>
    </div>
  );
};
