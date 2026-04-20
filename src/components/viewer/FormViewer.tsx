'use client';

import { useState } from 'react';
import { FormFactor, FormPage, FormBlock } from '@/lib/core/schema';
import styles from './FormViewer.module.css';
import { ChevronLeft, ChevronRight, Calendar, Star, Send, X, Clock, Monitor, Smartphone, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useFormStore } from '@/store/useFormStore';

interface FormViewerProps {
  formFactor: FormFactor;
  onClose?: () => void;
  onSubmit?: (responses: Record<string, any>) => Promise<boolean> | void;
  isPreview?: boolean;
}

export const FormViewer = ({ formFactor, onClose, onSubmit, isPreview = false }: FormViewerProps) => {
  const { viewport, setViewport } = useFormStore();
  const router = useRouter();

  const [currentPageType, setCurrentPageType] = useState<'start' | 'question' | 'ending'>('start');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

  const { pages, metadata } = formFactor;
  const questionPages = pages.questions;

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const validatePage = (page: FormPage) => {
    const newErrors: Record<string, boolean> = {};
    let firstErrorId: string | null = null;
    let firstErrorLabel: string = '';

    for (const block of page.blocks) {
      const value = responses[block.id];
      const isEmpty = (
        value === undefined || 
        value === null || 
        value === '' || 
        (Array.isArray(value) && value.length === 0) ||
        (block.type === 'rating' && value === 0)
      );
      
      if (block.validation?.required && isEmpty) {
        newErrors[block.id] = true;
        if (!firstErrorId) {
          firstErrorId = block.id;
          firstErrorLabel = block.content.label || '필수 문항';
        }
      }
    }

    setErrors(newErrors);

    if (firstErrorId) {
      showToast(`'${firstErrorLabel}' 문항을 입력해 주세요.`);
      const element = document.getElementById(`viewer-block-${firstErrorId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return { isValid: false };
    }

    return { isValid: true };
  };

  const handleStart = () => {
    const validation = validatePage(pages.start);
    if (!validation.isValid) return;

    if (questionPages.length > 0) {
      setCurrentPageType('question');
      setCurrentQuestionIdx(0);
      setErrors({});
    } else if (pages.endings.length > 0) {
      setCurrentPageType('ending');
      setErrors({});
    }
  };

  const handleNext = async () => {
    if (currentPageType === 'question') {
      const currentPage = questionPages[currentQuestionIdx];
      const validation = validatePage(currentPage);
      if (!validation.isValid) return;
    }

    if (currentQuestionIdx < questionPages.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      setErrors({});
    } else {
      if (onSubmit) {
        setIsSubmitting(true);
        try {
          await onSubmit(responses);
          setCurrentPageType('ending');
        } catch (error) {
          console.error('Failed to submit responses:', error);
          showToast('제출 중 오류가 발생했습니다. 다시 시도해 주세요.');
        } finally {
          setIsSubmitting(false);
        }
      } else {
        setCurrentPageType('ending');
      }
    }
    window.scrollTo(0, 0);
  };



  const handlePrev = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(prev => prev - 1);
    } else {
      setCurrentPageType('start');
    }
    window.scrollTo(0, 0);
  };

  const handleResponseChange = (blockId: string, value: any) => {
    setResponses(prev => ({ ...prev, [blockId]: value }));
    if (errors[blockId]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[blockId];
        return next;
      });
    }
  };


  const renderBlock = (block: FormBlock) => {
    const { type, content, id } = block;
    const value = responses[id];
    const isError = errors[id];

    switch (type) {
      case 'text':
      case 'textarea':
        return type === 'text' ? (
          <input
            type="text"
            className={`${styles.input} ${isError ? styles.inputError : ''}`}
            placeholder={content.placeholder || '응답을 입력해 주세요.'}
            value={value || ''}
            onChange={(e) => handleResponseChange(id, e.target.value)}
          />
        ) : (
          <textarea
            className={`${styles.textarea} ${isError ? styles.inputError : ''}`}
            placeholder={content.placeholder || '응답을 입력해 주세요.'}
            value={value || ''}
            onChange={(e) => handleResponseChange(id, e.target.value)}
          />
        );

      case 'choice':
        return (
          <div className={styles.optionsList}>
            {content.options?.map((option, i) => {
              const isSelected = content.multiSelect 
                ? (value || []).includes(option)
                : value === option;
              
              const handleClick = () => {
                if (content.multiSelect) {
                  const currentSelected = value || [];
                  const nextSelected = currentSelected.includes(option)
                    ? currentSelected.filter((o: string) => o !== option)
                    : [...currentSelected, option];
                  handleResponseChange(id, nextSelected);
                } else {
                  handleResponseChange(id, option);
                }
              };

              return (
                <div 
                  key={i} 
                  className={`${styles.option} ${isSelected ? styles.optionActive : ''} ${isError ? styles.optionError : ''}`}
                  onClick={handleClick}
                >
                  <div className={styles.optionControl}>
                    <input 
                      type={content.multiSelect ? "checkbox" : "radio"} 
                      checked={isSelected}
                      readOnly
                      className={content.multiSelect ? styles.checkbox : styles.radio}
                    />
                  </div>
                  <span className={styles.optionLabel}>{option}</span>
                </div>
              );
            })}
            {content.allowOther && (
              <div 
                className={`${styles.option} ${value === '__other__' ? styles.optionActive : ''} ${isError ? styles.optionError : ''}`}
                onClick={() => handleResponseChange(id, '__other__')}
              >
                <div className={styles.optionControl}>
                  <input type="radio" checked={value === '__other__'} readOnly />
                </div>
                <span className={styles.optionLabel} style={{ color: '#94a3b8' }}>기타 (직접 입력)</span>
              </div>
            )}
            {value === '__other__' && (
              <input 
                type="text" 
                className={`${styles.input} ${isError ? styles.inputError : ''}`} 
                style={{ marginTop: '8px' }}
                placeholder="내용을 입력해 주세요."
                onChange={(e) => handleResponseChange(`${id}_other`, e.target.value)}
              />
            )}
          </div>
        );

      case 'rating':
        return (
          <div className={`${styles.ratingWrapper} ${isError ? styles.ratingError : ''}`} style={{ display: 'flex', gap: '8px', padding: isError ? '8px' : '0', borderRadius: '8px' }}>
            {[...Array(content.maxRating || 5)].map((_, i) => (
              <Star 
                key={i} 
                size={32} 
                fill={(value || 0) > i ? "#2563eb" : "none"}
                stroke={(value || 0) > i ? "#2563eb" : "#e2e8f0"}
                style={{ cursor: 'pointer' }}
                onClick={() => handleResponseChange(id, i + 1)}
              />
            ))}
          </div>
        );

      case 'date':
        return (
          <div style={{ position: 'relative' }}>
            <input 
              type="date" 
              className={`${styles.input} ${isError ? styles.inputError : ''}`}
              value={value || ''}
              onChange={(e) => handleResponseChange(id, e.target.value)}
            />
          </div>
        );


      case 'statement':
        return (
          <div className={styles.statement}>
             {content.label && <h2 className={styles.statementTitle}>{content.label}</h2>}
             {content.body && <p className={styles.statementBody}>{content.body}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  const renderPage = (page: FormPage) => (
    <div className={styles.page}>
      {page.type !== 'start' && page.type !== 'ending' && (
        <div style={{ marginBottom: '32px' }}>
          {page.description && <p className={styles.description} style={{ border: 'none', padding: 0 }}>{page.description}</p>}
        </div>
      )}
      {page.blocks.map(block => (
        <div key={block.id} id={`viewer-block-${block.id}`} className={styles.questionItem}>
          {block.type !== 'statement' && (
            <>
              <label className={`${styles.questionLabel} ${errors[block.id] ? styles.labelError : ''}`}>
                {block.validation?.required && <span className={styles.required}>*</span>}
                {block.content.label}
              </label>
              {block.content.helpText && <p className={styles.helpText}>{block.content.helpText}</p>}
            </>
          )}
          {renderBlock(block)}
        </div>
      ))}
    </div>
  );


  return (
    <div className={styles.viewerContainer} data-viewport={isPreview ? viewport : 'desktop'}>
      {isPreview && (
        <>
          <button className={styles.exitBtn} onClick={onClose}>
            <X size={16} /> 종료하기
          </button>
          
          <div className={styles.previewToggle}>
            <button 
              className={`${styles.toggleBtn} ${viewport === 'desktop' ? styles.toggleBtnActive : ''}`}
              onClick={() => setViewport('desktop')}
            >
              <Monitor size={16} />
              <span>Desktop</span>
            </button>
            <button 
              className={`${styles.toggleBtn} ${viewport === 'mobile' ? styles.toggleBtnActive : ''}`}
              onClick={() => setViewport('mobile')}
            >
              <Smartphone size={16} />
              <span>Mobile</span>
            </button>
          </div>
        </>
      )}

      <div className={styles.card}>
        <div className={styles.content}>
          {currentPageType === 'start' && renderPage(pages.start)}
          
          {currentPageType === 'question' && renderPage(questionPages[currentQuestionIdx])}
          
          {currentPageType === 'ending' && (
            pages.endings.length > 0 ? renderPage(pages.endings[0]) : (
              <div className={styles.statement}>
                <p className={styles.statementBody}>좋은 하루 되세요!</p>
              </div>
            )
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerBranding}>
            Powered by <strong>Formia</strong>
          </div>
          <div className={styles.footerActions}>
            {currentPageType !== 'start' && (
              <button 
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={handlePrev}
              >
                이전
              </button>
            )}
            
            {currentPageType !== 'ending' ? (
              <button 
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={currentPageType === 'start' ? handleStart : handleNext}
                disabled={isSubmitting}
              >
                {isSubmitting ? '처리 중...' : (
                  currentPageType === 'question' && currentQuestionIdx === questionPages.length - 1 
                    ? '제출하기' 
                    : '다음'
                )}
              </button>
            ) : (
              <button 
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={onClose}
              >
                닫기
              </button>
            )}
          </div>
        </div>
      </div>

      {toast.visible && (
        <div className={styles.toast}>
          <div className={styles.toastContent}>
            <AlertCircle size={16} color="#fbbf24" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

