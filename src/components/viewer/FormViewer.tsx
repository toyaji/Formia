'use client';

import { useState } from 'react';
import { FormFactor, FormPage, FormBlock } from '@/lib/core/schema';
import styles from './FormViewer.module.css';
import { ChevronLeft, ChevronRight, Calendar, Star, Send, X, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FormViewerProps {
  formFactor: FormFactor;
  onClose?: () => void;
  isPreview?: boolean;
}

export const FormViewer = ({ formFactor, onClose, isPreview = false }: FormViewerProps) => {
  const router = useRouter();
  const [currentPageType, setCurrentPageType] = useState<'start' | 'question' | 'ending'>('start');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});

  const { pages, metadata } = formFactor;
  const questionPages = pages.questions;

  const handleStart = () => {
    if (questionPages.length > 0) {
      setCurrentPageType('question');
      setCurrentQuestionIdx(0);
    } else if (pages.endings.length > 0) {
      setCurrentPageType('ending');
    }
  };

  const handleNext = () => {
    if (currentQuestionIdx < questionPages.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else {
      setCurrentPageType('ending');
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
  };

  const renderBlock = (block: FormBlock) => {
    const { type, content, id } = block;
    const value = responses[id];

    switch (type) {
      case 'text':
      case 'textarea':
        return type === 'text' ? (
          <input
            type="text"
            className={styles.input}
            placeholder={content.placeholder || '응답을 입력해 주세요.'}
            value={value || ''}
            onChange={(e) => handleResponseChange(id, e.target.value)}
          />
        ) : (
          <textarea
            className={styles.textarea}
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
                  className={`${styles.option} ${isSelected ? styles.optionActive : ''}`}
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
                className={`${styles.option} ${value === '__other__' ? styles.optionActive : ''}`}
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
                className={styles.input} 
                style={{ marginTop: '8px' }}
                placeholder="내용을 입력해 주세요."
                onChange={(e) => handleResponseChange(`${id}_other`, e.target.value)}
              />
            )}
          </div>
        );

      case 'rating':
        return (
          <div className={styles.ratingWrapper} style={{ display: 'flex', gap: '8px' }}>
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
              className={styles.input}
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
        <div key={block.id} className={styles.questionItem}>
          {block.type !== 'statement' && (
            <>
              <label className={styles.questionLabel}>
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
    <div className={styles.viewerContainer}>
      {isPreview && (
        <button className={styles.exitBtn} onClick={onClose}>
          <X size={16} /> 종료하기
        </button>
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
              >
                {currentPageType === 'question' && currentQuestionIdx === questionPages.length - 1 
                  ? '제출하기' 
                  : '다음'}
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
    </div>
  );
};
