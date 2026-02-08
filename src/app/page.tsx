'use client';

import { useEffect } from 'react';
import styles from './page.module.css';
import { useFormStore } from '@/store/useFormStore';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { Sidebar } from '@/components/layout/Sidebar';
import { AiPanel } from '@/components/ai/AiPanel';
import { Header } from '@/components/layout/Header';
import { Undo2, Redo2 } from 'lucide-react';
import { getNewBlockPreviews } from '@/lib/utils/patchUtils';

export default function Home() {
  const { 
    formFactor, setFormFactor, getEffectiveFactor, 
    activePageId, setActivePageId, viewport, undo, redo, history, future, 
    activeBlockId, setActiveBlockId, applyJsonPatch,
    isReviewMode, pendingPatches
  } = useFormStore();
  const effectiveFactor = getEffectiveFactor();

  // Find current active page
  const activePage = effectiveFactor?.pages.find(p => p.id === activePageId) || effectiveFactor?.pages[0];
  
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
            blocks: [
              {
                id: '1',
                type: 'choice',
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
            title: '설문 종료',
            blocks: []
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
      <section className={styles.centerCanvas}>
        <div style={{ 
          maxWidth: viewport === 'mobile' ? '375px' : '800px', 
          width: '100%',
          transition: 'max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          margin: '0 auto',
          padding: '40px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
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

          {effectiveFactor?.pages.map((page) => {
            const isActive = activePageId === page.id;
            const isStartPage = page.type === 'start';
            const isEndingPage = page.type === 'ending';
            
            // Calculate page label
            let pageLabel = '페이지';
            if (isStartPage) pageLabel = '시작 페이지';
            else if (isEndingPage) {
                 const endingPages = effectiveFactor?.pages.filter(p => p.type === 'ending') || [];
                 const index = endingPages.findIndex(p => p.id === page.id);
                 pageLabel = index === 0 ? '설문 종료' : '조기 종료';
            }
            else {
                const questionPages = effectiveFactor?.pages.filter(p => !p.type || p.type === 'default') || [];
                const index = questionPages.findIndex(p => p.id === page.id);
                pageLabel = `${index + 1}페이지`;
            }

            return (
              <div key={page.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Page Label moved outside */}
                <span style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: isActive ? 'var(--f-primary)' : 'var(--f-text-muted)',
                  marginLeft: '4px'
                }}>
                  {pageLabel}
                </span>

              <div 
                id={`page-${page.id}`}
                onClick={() => {
                   // Set active page when clicking on the card
                   if (activePageId !== page.id) {
                     setActivePageId(page.id);
                   }
                }}
                style={{ 
                  background: 'var(--f-surface)', 
                  padding: '40px', 
                  borderRadius: 'var(--f-radius-xl)',
                  boxShadow: 'var(--f-shadow-premium)',
                  minHeight: isStartPage ? 'auto' : '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '32px',
                  border: isReviewMode ? '2px solid #22C55E' : '1px solid var(--f-border)',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  opacity: isActive ? 1 : 0.7,
                }}
              >
                {/* Removed internal label */}

                {/* Start Page: Metadata Inputs */}
                {isStartPage && (
                  <div 
                    className={`${styles.metadataContainer} ${activeBlockId === 'form-metadata' && !isReviewMode ? styles.activeMetadata : ''}`}
                    onClick={(e) => {
                      if (isReviewMode) return;
                      e.stopPropagation();
                      setActiveBlockId('form-metadata');
                    }}
                  >
                    {activeBlockId === 'form-metadata' && !isReviewMode ? (
                      <>
                        <input 
                          className={styles.titleInput}
                          value={effectiveFactor?.metadata.title || ''}
                          onChange={(e) => {
                            applyJsonPatch([{
                              op: 'replace',
                              path: '/metadata/title',
                              value: e.target.value
                            }]);
                          }}
                          placeholder="폼 제목을 입력하세요"
                        />
                        <textarea 
                          className={styles.descriptionInput}
                          value={effectiveFactor?.metadata.description || ''}
                          onChange={(e) => {
                            applyJsonPatch([{
                              op: 'replace',
                              path: '/metadata/description',
                              value: e.target.value
                            }]);
                          }}
                          placeholder="폼 설명을 입력하세요 (선택 사항)"
                        />
                      </>
                    ) : (
                      <>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>
                          {effectiveFactor?.metadata.title}
                        </h1>
                        {effectiveFactor?.metadata.description && (
                          <p style={{ color: 'var(--f-text-muted)', fontSize: '1rem' }}>
                            {effectiveFactor.metadata.description}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Render Blocks */}
                {page.blocks.map((block: import('@/lib/core/schema').FormBlock) => (
                  <BlockRenderer key={block.id} block={block} />
                ))}

                {/* New Block Previews (only for this page) */}
                {/* To correctly map previews to pages, we might need logic. 
                    For now, assuming previews are mostly relevant to active page or we map them.
                    Simplified: Only show previews if this is the ACTIVE page. 
                */}
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

          {/* Floating Action Bar for History */}
          <div className={styles.floatingActions}>
            <button onClick={undo} disabled={history.length === 0} className={styles.actionBtn} title="Undo">
              <Undo2 size={18} />
            </button>
            <button onClick={redo} disabled={future.length === 0} className={styles.actionBtn} title="Redo">
              <Redo2 size={18} />
            </button>
          </div>
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
