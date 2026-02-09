'use client';

import { useEffect, useMemo } from 'react';
import styles from './page.module.css';
import diffStyles from '@/components/builder/PageDiff.module.css';
import { useFormStore } from '@/store/useFormStore';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { Sidebar } from '@/components/layout/Sidebar';
import { AiPanel } from '@/components/ai/AiPanel';
import { Header } from '@/components/layout/Header';
import { Undo2, Redo2, Check, X } from 'lucide-react';
import { getNewBlockPreviews, getReviewPages, ReviewFormPage } from '@/lib/utils/patchUtils';
import { FormPage } from '@/lib/core/schema';

export default function Home() {
  const { 
    formFactor, setFormFactor, getEffectiveFactor, 
    activePageId, setActivePageId, viewport, undo, redo, history, future, 
    activeBlockId, setActiveBlockId, applyJsonPatch,
    isReviewMode, pendingPatches, preReviewSnapshot,
    acceptPatch, rejectPatch, resolvePagePatch
  } = useFormStore();
  const effectiveFactor = getEffectiveFactor();

  // Compute pages to render (Normal vs Review)
  const pagesToRender = useMemo(() => {
    if (isReviewMode && preReviewSnapshot && effectiveFactor) {
      return getReviewPages(preReviewSnapshot.pages, effectiveFactor.pages, pendingPatches);
    }
    return (effectiveFactor?.pages || []).map(p => ({ ...p, reviewStatus: 'kept' as const }));
  }, [isReviewMode, preReviewSnapshot, effectiveFactor, pendingPatches]);

  // Find current active page
  const activePage = pagesToRender.find(p => p.id === activePageId) || pagesToRender[0];
  
  // Get new blocks that need to be previewed
  const newBlockPreviews = getNewBlockPreviews(pendingPatches);

  // Initialize with a default schema for testing (v2)
  useEffect(() => {
    if (!formFactor) {
      setFormFactor({
        version: '2.0.0',
        metadata: {
          title: '젤리 설문조사 이벤트 응모',
          description: '반려견 정보를 입력하고 이벤트에 참여하세요!',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        theme: {
          mode: 'light',
          tokens: {
            primary: '#3B82F6',
          },
        },
        pages: [
          {
            id: 'page-start',
            type: 'start',
            title: '시작 페이지',
            removable: false,
            blocks: [
              {
                id: 'start-header',
                type: 'statement',
                removable: false,
                content: {
                  label: '젤리 설문조사 이벤트 응모',
                  body: '반려견 정보를 입력하고 이벤트에 참여하세요!'
                }
              },
              {
                id: '1',
                type: 'choice',
                removable: true,
                content: { 
                    label: '현재 반려동물을 키우고 계신가요?', 
                    options: ['예', '아니오']
                },
                validation: { required: true }
              }
            ]
          },
          {
            id: 'page-end',
            type: 'ending',
            title: '종료 페이지',
            removable: false,
            blocks: [
              {
                id: 'end-header',
                type: 'statement',
                removable: false,
                content: {
                  label: '제출이 완료되었습니다.',
                  body: '답변해 주셔서 감사합니다.'
                }
              }
            ]
          }
        ],
      });
    }
  }, [formFactor, setFormFactor]);

  // Scroll to active page
  useEffect(() => {
    if (activePageId) {
      const element = document.getElementById(`page-${activePageId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [activePageId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <Header />
      <main className={styles.container}>
        {/* Left Sidebar: Structure & Navigation */}
        <aside className={styles.leftPanel}>
          <Sidebar />
        </aside>

      {/* Center Canvas: WYSIWYG Builder */}
      <section 
        className={styles.centerCanvas}
        data-viewport={viewport}
        style={{
          padding: viewport === 'mobile' ? '40px 16px' : '80px 40px',
        }}
      >
        <div style={{ 
          width: viewport === 'mobile' ? '375px' : '800px', 
          flexShrink: 0,
          transition: 'width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: viewport === 'mobile' ? '16px' : '24px'
        }}>
          {isReviewMode && (
             <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                <span style={{ 
                  fontSize: '0.75rem', 
                  background: 'linear-gradient(135deg, #22C55E, #16A34A)', 
                  color: 'white', 
                  padding: '4px 12px', 
                  borderRadius: '20px',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  ✨ 리뷰 모드 - 변경사항을 확인하세요
                </span>
             </div>
          )}

          {pagesToRender.map((pageBase) => {
            const page = pageBase as ReviewFormPage;
            const isActive = activePageId === page.id;
            const isStartPage = page.type === 'start';
            const isEndingPage = page.type === 'ending';
            const isRemoved = page.reviewStatus === 'removed';
            const isAdded = page.reviewStatus === 'added';
            
            const pageLabel = page.title;

            return (
              <div key={page.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Page Label moved outside */}
                <span style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: isRemoved ? '#EF4444' : (isAdded ? '#22C55E' : (isActive ? 'var(--f-primary)' : 'var(--f-text-muted)')),
                  marginLeft: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  position: 'relative' // For absolute positioning if needed, or flex flow
                }}>
                  {pageLabel}
                  
                  {/* Review Actions Chip - Only Buttons */}
                  {isReviewMode && (isAdded || isRemoved) && page.relatedPatchId && (
                    <div 
                      className={diffStyles.reviewChip} 
                      data-change-type={isAdded ? 'add' : 'remove'}
                      style={{ marginLeft: '8px' }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          resolvePagePatch(page.relatedPatchId!, 'accept');
                        }}
                        title="변경사항 수락"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          resolvePagePatch(page.relatedPatchId!, 'reject');
                        }}
                        title="변경사항 거절"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </span>

              <div 
                id={`page-${page.id}`}
                onClick={() => {
                   if (isRemoved) return;
                   // Set active page when clicking on the card
                   if (activePageId !== page.id) {
                     setActivePageId(page.id);
                   }
                }}
                style={{ 
                  background: 'var(--f-surface)', 
                  padding: viewport === 'mobile' ? '24px 16px' : '40px', 
                  borderRadius: 'var(--f-radius-xl)',
                  boxShadow: 'var(--f-shadow-premium)',
                  minHeight: isStartPage ? 'auto' : '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: viewport === 'mobile' ? '24px' : '32px',
                  border: isRemoved ? '2px dashed #EF4444' : (isAdded ? '2px solid #22C55E' : (isReviewMode ? '2px solid #e2e8f0' : '1px solid var(--f-border)')),
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  opacity: isRemoved ? 0.6 : (isActive ? 1 : 0.7),
                  pointerEvents: isRemoved ? 'none' : 'auto',
                  filter: isRemoved ? 'grayscale(0.5)' : 'none',
                }}
              >
                {/* Removed internal label */}

                {/* Render Blocks */}
                {page.blocks.map((block: import('@/lib/core/schema').FormBlock) => (
                  <BlockRenderer key={block.id} block={block} />
                ))}

                {/* New Block Previews (only for this page) */}
                {isActive && newBlockPreviews.map((preview) => (
                  <BlockRenderer 
                    key={preview.targetBlockId} 
                    block={preview.block} 
                    previewBlockId={preview.targetBlockId}
                  />
                ))}

                {page.blocks.length === 0 && !isStartPage && !isEndingPage && (
                  <p style={{ textAlign: 'center', color: 'var(--f-text-muted)', marginTop: '20px' }}>
                    문항이 없습니다.
                  </p>
                )}
              </div>
              </div>
            );
          })}


        </div>
      </section>

      {/* Right Sidebar: AI Agent Panel */}
      <aside className={styles.rightPanel}>
        <AiPanel />
      </aside>
      </main>
    </div>
  );
}
