'use client';

import { useState, useRef, useEffect } from 'react';
import { useFormStore, Message, PatchItem } from '@/store/useFormStore';
import { useAIPatch } from '@/hooks/useAIPatch';
import styles from './AiPanel.module.css';
import { Send, Trash2, Check, X, AlertCircle, RotateCcw, History, Plus, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { convertOperationsToPatchItems } from '@/lib/utils/patchUtils';
import { PatchDebugger } from '../viewer/PatchDebugger';

// Typing Indicator Component
const TypingIndicator = () => (
  <div className={styles.typingIndicator}>
    <span></span>
    <span></span>
    <span></span>
  </div>
);

// Proposed Changes Card
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
    messages, addMessage, clearMessages, formFactor,
    saveSnapshot, setReviewMode, setPendingPatches, setActiveBlockId,
    aiKeyStatus, setAiKeyStatus, config
  } = useFormStore();
  const activeProvider = config.activeAiProvider || 'gemini';
  const isAiActive = aiKeyStatus[activeProvider]?.active;
  const providerLabel = activeProvider === 'openai' ? 'OpenAI' : 'Gemini';
  const { generatePatchWithSummary, isLoading, streamingText } = useAIPatch();
  const [input, setInput] = useState('');
  const [isValidating, setIsValidating] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { 
    currentSessionId, chatSessions, isLoadingSessions,
    loadChatSessions, startNewChat, switchChatSession, deleteChatSession
  } = useFormStore();


  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/secrets/status');
        if (res.ok) {
          const status = await res.json();
          Object.entries(status).forEach(([provider, data]: [string, any]) => {
            setAiKeyStatus(provider, data);
          });
        }
      } catch (e) {
        console.error('Failed to fetch AI key status:', e);
      } finally {
        setIsValidating(false);
      }
    };
    
    // Always fetch on mount to ensure we have the latest server state (session/db)
    fetchStatus();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, streamingText]);

  const processAIRequest = async (userQuery: string) => {
    const result = await generatePatchWithSummary(userQuery, false);

    if (result && result.patches.length > 0 && formFactor) {
      console.log('[AiPanel] AI Proposed Patches:', result.patches);
      saveSnapshot();
      setActiveBlockId(null);
      
      const patchItems = convertOperationsToPatchItems(result.patches, formFactor);
      setPendingPatches(patchItems);
      setReviewMode(true);
      
      addMessage({
        role: 'assistant',
        content: result.summary,
      });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !isAiActive) return;

    const userQuery = input;
    setInput('');

    addMessage({
      role: 'user',
      content: userQuery,
    });

    await processAIRequest(userQuery);
  };

  const handleRetry = async (content: string) => {
    if (isLoading || !isAiActive) return;
    await processAIRequest(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getSendButtonTitle = () => {
    if (isValidating) return 'API 키 상태 확인 중...';
    if (!isAiActive) return `${providerLabel} API 키 설정이 필요합니다`;
    if (!input.trim()) return '요청 사항을 입력하세요';
    return '요청 보내기';
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>Formia AI</span>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={styles.clearBtn} 
            onClick={() => setShowHistory(true)} 
            title="대화 히스토리"
            style={{ position: 'relative' }}
          >
            <History size={18} />
            {chatSessions.length > 0 && <div className={styles.historyBadge} />}
          </button>
          <button className={styles.clearBtn} onClick={startNewChat} title="새 대화 시작">
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className={styles.historyPanel}>
          <div className={styles.historyHeader}>
            <button className={styles.backBtn} onClick={() => setShowHistory(false)}>
              <ArrowLeft size={20} />
            </button>
            <span className={styles.historyTitle}>대화 히스토리</span>
          </div>

          <button 
            className={styles.newChatBtn} 
            onClick={() => {
              startNewChat();
              setShowHistory(false);
            }}
          >
            <Plus size={18} /> 새로운 채팅 시작
          </button>

          <div className={styles.sessionList}>
            {chatSessions.length === 0 ? (
              <div className={styles.emptyHistory}>
                저장된 대화 기록이 없어요.
              </div>
            ) : (
              chatSessions.map((session) => (
                <div 
                  key={session.id} 
                  className={`${styles.sessionItem} ${currentSessionId === session.id ? styles.active : ''}`}
                  onClick={() => {
                    switchChatSession(session.id);
                    setShowHistory(false);
                  }}
                >
                  <div className={styles.sessionInfo}>
                    <div className={styles.sessionName}>{session.title || 'Untitled Chat'}</div>
                    <div className={styles.sessionDate}>
                      {format(new Date(session.createdAt), 'PPP p', { locale: ko })}
                    </div>
                  </div>
                  <button 
                    className={styles.deleteSessionBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChatSession(session.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Message List - Modern Style */}
      <div className={styles.messageList}>
        {/* API Key Setup Prompt - Restored Original structure but placed above welcome */}
        {!isValidating && !isAiActive && messages.length === 0 && (
          <div className={styles.setupPrompt}>
            <div className={styles.setupIcon}>🔑</div>
            <div className={styles.setupContent}>
              <h3 className={styles.setupTitle}>{providerLabel} API 키를 설정해주세요</h3>
              <p className={styles.setupDesc}>
                AI 기능을 사용하려면 먼저 {providerLabel} API 키를 등록해야 합니다.
                <br />
                상단 설정(⚙️) 버튼을 눌러 키를 입력하세요.
              </p>
            </div>
          </div>
        )}

        {/* Welcome message - Always visible when chat is empty */}
        {messages.length === 0 && (
          <div className={styles.assistantMessage}>
            안녕하세요! 어떤 폼을 만들고 싶으신가요?
          </div>
        )}

        {messages.map((msg: Message, idx: number) => {
          if (msg.role === 'system_error') {
            return (
              <div key={idx} className={`${styles.systemMessage} ${styles.error}`}>
                <AlertCircle size={16} />
                <div className={styles.messageText}>{msg.content}</div>
              </div>
            );
          }

          if (msg.role === 'user') {
            return (
              <div key={idx} className={styles.userMessage}>
                <div className={styles.messageText}>{msg.content}</div>
                <button 
                  className={styles.retryBtn} 
                  onClick={() => handleRetry(msg.content)}
                  title="다시 시도"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            );
          }

          // Assistant message - clean text style
          return (
            <div key={idx} className={styles.assistantMessage}>
              {msg.content}

            </div>
          );
        })}

        {/* Typing Indicator */}
        {isLoading && <TypingIndicator />}

        {/* Streaming Text Preview */}
        {streamingText && (
          <div className={styles.assistantMessage}>
            {streamingText}
          </div>
        )}

        {/* Proposed Changes Card */}
        <ProposedChanges />

        {/* JSON Patch DevTools Debugger */}
        <PatchDebugger />
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Floating Style */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <textarea
            className={styles.textarea}
            placeholder="여기에 요청하세요..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <div className={`${styles.sendBtnWrapper} f-tooltip-container`} data-tooltip={getSendButtonTitle()}>
            <button 
              className={styles.sendBtn} 
              onClick={handleSend}
              disabled={isLoading || !input.trim() || !isAiActive || isValidating}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
