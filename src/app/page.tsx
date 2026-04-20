'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import diffStyles from '@/components/builder/PageDiff.module.css';
import { useFormStore } from '@/store/useFormStore';
import { useHydrated } from '@/hooks/useHydrated';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { Sidebar } from '@/components/layout/Sidebar';
import { AiPanel } from '@/components/ai/AiPanel';
import { Header } from '@/components/layout/Header';
import { RestoreDraftPrompt } from '@/components/builder/RestoreDraftPrompt';
import { Undo2, Redo2, Check, X, Eye } from 'lucide-react';
import { ReviewFormPage, sortPages } from '@/lib/utils/patchUtils';
import { FormPage } from '@/lib/core/schema';
import { useSession } from 'next-auth/react';
import { EditablePageTitle } from '@/components/builder/EditablePageTitle';
import { getDefaultForm } from '@/lib/constants/defaultForm';

export default function Home() {
  const { data: session } = useSession();
  const { 
    formFactor, setFormFactor, getEffectiveFactor, 
    activePageId, setActivePageId, viewport, undo, redo, history, future, 
    activeBlockId, setActiveBlockId, applyJsonPatch,
    isReviewMode, pendingPatches, preReviewSnapshot,
    acceptPatch, rejectPatch, resolvePagePatch,
    getReviewViewModel, setSession, initApp, formId
  } = useFormStore();
  
  const [aiPanelWidth, setAiPanelWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);

  const mounted = useHydrated();

  // Initialize app: sync session and load last form
  useEffect(() => {
    setSession(session);
    initApp(session);
  }, [session, setSession, initApp]);

  const effectiveFactor = getEffectiveFactor();

  // Compute pages to render (Normal vs Review)
  const pagesToRender = useMemo(() => {
    // If we're not mounted, we show the global spinner, so this empty array is fine
    if (!mounted || !effectiveFactor) return [] as ReviewFormPage[];
    
    if (isReviewMode) {
      return getReviewViewModel();
    }

    const result: ReviewFormPage[] = [];
    
    const pages = effectiveFactor.pages;
    if (!pages) return [] as ReviewFormPage[];

    if (pages.start) {
      result.push({ 
        ...pages.start, 
        reviewMetadata: { status: 'kept' as const, patchId: undefined, fieldPatches: {} },
        blocks: (pages.start.blocks || []).map(b => ({ 
          ...b, 
          reviewMetadata: { status: 'kept' as const, patchId: undefined, fieldPatches: {} } 
        }))
      });
    }

    (pages.questions || []).forEach(p => {
      result.push({ 
        ...p, 
        reviewMetadata: { status: 'kept' as const, patchId: undefined, fieldPatches: {} },
        blocks: (p.blocks || []).map(b => ({ 
          ...b, 
          reviewMetadata: { status: 'kept' as const, patchId: undefined, fieldPatches: {} } 
        }))
      });
    });

    (pages.endings || []).forEach((p) => {
      result.push({ 
        ...p, 
        reviewMetadata: { status: 'kept' as const, patchId: undefined, fieldPatches: {} },
        blocks: (p.blocks || []).map(b => ({ 
          ...b, 
          reviewMetadata: { status: 'kept' as const, patchId: undefined, fieldPatches: {} } 
        }))
      });
    });

    return result;
  }, [mounted, isReviewMode, effectiveFactor, getReviewViewModel]);

  // Find current active page with robust fallback
  // If activePageId is null or not found, always try to grab the first page
  const activePage = useMemo(() => {
    return pagesToRender.find(p => p.id === activePageId) || pagesToRender[0];
  }, [pagesToRender, activePageId]);
  



  // Resizing logic
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      // Calculate new width: viewport width - mouse X
      const newWidth = window.innerWidth - e.clientX;
      
      // Constraints: Min 300px, Max 800px or 50% of screen
      const minWidth = 300;
      const maxWidth = Math.min(800, window.innerWidth * 0.5);
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setAiPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (!mounted) {
    return (
      <div style={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'var(--f-background)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '4px solid var(--f-border)', 
            borderTopColor: 'var(--f-primary)', 
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: 'var(--f-text-muted)', fontSize: '0.9rem' }}>애플리케이션을 초기화하고 있습니다...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

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

          {/* 1. Start Page */}
          {pagesToRender.filter(p => p.type === 'start').map((page) => (
            <div key={page.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <EditablePageTitle 
                page={page}
                isActive={activePageId === page.id}
                isAdded={page.reviewMetadata.status === 'added'}
                isRemoved={page.reviewMetadata.status === 'removed'}
                isReviewMode={isReviewMode}
                patchId={page.reviewMetadata.patchId}
              />
              <div 
                id={`page-${page.id}`}
                onClick={() => { if (activePageId !== page.id) setActivePageId(page.id); }}
                style={{ 
                  background: 'var(--f-surface)', 
                  padding: viewport === 'mobile' ? '20px 12px' : '32px', 
                  borderRadius: 'var(--f-radius-xl)',
                  boxShadow: 'var(--f-shadow-premium)',
                  border: '1px solid var(--f-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: viewport === 'mobile' ? '16px' : '20px',
                  opacity: activePageId === page.id ? 1 : 0.7,
                  cursor: activePageId === page.id ? 'default' : 'pointer'
                }}
              >
                {page.blocks.map((block: any) => (
                  <BlockRenderer key={block.id} block={block} />
                ))}
              </div>
            </div>
          ))}

          {/* 2. Question Pages (Draggable-equivalent order) */}
          {pagesToRender.filter(p => p.type !== 'start' && p.type !== 'ending').map((page) => {
            const isActive = activePageId === page.id;
            const isRemoved = page.reviewMetadata.status === 'removed';
            const isAdded = page.reviewMetadata.status === 'added';
            const patchId = page.reviewMetadata.patchId;

            return (
              <div key={page.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <EditablePageTitle 
                  page={page}
                  isActive={isActive}
                  isAdded={isAdded}
                  isRemoved={isRemoved}
                  isReviewMode={isReviewMode}
                  patchId={patchId}
                />

                <div 
                  id={`page-${page.id}`}
                  onClick={() => { if (!isRemoved && activePageId !== page.id) setActivePageId(page.id); }}
                  style={{ 
                    background: 'var(--f-surface)', 
                    padding: viewport === 'mobile' ? '20px 12px' : '32px', 
                    borderRadius: 'var(--f-radius-xl)',
                    boxShadow: 'var(--f-shadow-premium)',
                    minHeight: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: viewport === 'mobile' ? '16px' : '20px',
                    border: isRemoved ? '2px dashed #EF4444' : (isAdded ? '2px solid #22C55E' : (isReviewMode ? '2px solid #e2e8f0' : '1px solid var(--f-border)')),
                    opacity: isRemoved ? 0.6 : (isActive ? 1 : 0.7),
                    pointerEvents: isRemoved ? 'none' : 'auto'
                  }}
                >
                  {page.blocks.map((block: any) => (
                    <BlockRenderer 
                      key={block.id} 
                      block={block} 
                      isParentChange={isAdded || isRemoved} 
                    />
                  ))}
                  {page.blocks.length === 0 && <p style={{ textAlign: 'center', color: 'var(--f-text-muted)', marginTop: '20px' }}>문항이 없습니다.</p>}
                </div>
              </div>
            );
          })}

          {/* 3. Ending Pages */}
          {pagesToRender.filter(p => p.type === 'ending').map((page) => {
            const isRemoved = page.reviewMetadata.status === 'removed';
            const isAdded = page.reviewMetadata.status === 'added';
            const patchId = page.reviewMetadata.patchId;

            return (
              <div key={page.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <EditablePageTitle 
                  page={page}
                  isActive={activePageId === page.id}
                  isAdded={isAdded}
                  isRemoved={isRemoved}
                  isReviewMode={isReviewMode}
                  patchId={patchId}
                />
                <div 
                  id={`page-${page.id}`}
                  onClick={() => { if (!isRemoved && activePageId !== page.id) setActivePageId(page.id); }}
                  style={{ 
                    background: 'var(--f-surface)', 
                    padding: viewport === 'mobile' ? '16px 12px' : '24px', 
                    borderRadius: 'var(--f-radius-xl)',
                    boxShadow: 'var(--f-shadow-premium)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: viewport === 'mobile' ? '16px' : '20px',
                    border: isRemoved ? '2px dashed #EF4444' : (isAdded ? '2px solid #22C55E' : (isReviewMode ? '2px solid #e2e8f0' : '1px solid var(--f-border)')),
                    opacity: isRemoved ? 0.6 : (activePageId === page.id ? 1 : 0.7),
                    cursor: (isRemoved || activePageId === page.id) ? 'default' : 'pointer'
                  }}
                >
                  {page.blocks.map((block: any) => (
                    <BlockRenderer 
                      key={block.id} 
                      block={block} 
                      isParentChange={isAdded || isRemoved}
                    />
                  ))}
                </div>
              </div>
            );
          })}


        </div>
      </section>

      {/* Right Sidebar: AI Agent Panel */}
      <aside 
        className={styles.rightPanel} 
        style={{ 
          width: `${aiPanelWidth}px`,
          position: 'relative'
        }}
      >
        {/* Resize Handle */}
        <div 
          onMouseDown={startResizing}
          className={`${styles.resizer} ${isResizing ? styles.resizerActive : ''}`}
        />
        <AiPanel />
      </aside>
      </main>
      {/* Restore Draft Prompt for Guests */}
      <RestoreDraftPrompt />
    </div>
  );
}
