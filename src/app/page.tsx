'use client';

import { useEffect } from 'react';
import styles from './page.module.css';
import { useFormStore } from '@/store/useFormStore';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { Sidebar } from '@/components/layout/Sidebar';
import { AiPanel } from '@/components/ai/AiPanel';
import { Header } from '@/components/layout/Header';
import { Undo2, Redo2, Save } from 'lucide-react';
import { getNewBlockPreviews } from '@/lib/utils/patchUtils';

export default function Home() {
  const { 
    formFactor, setFormFactor, getEffectiveFactor, 
    activePageId, viewport, undo, redo, history, future, 
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
            id: 'page-1',
            title: '시작 페이지',
            blocks: [
              {
                id: '1',
                type: 'text',
                content: { label: '이름', placeholder: '반려견의 이름을 입력해주세요.' },
                validation: { required: true }
              },
              {
                id: '2',
                type: 'choice',
                content: { label: '견종', options: ['말티즈', '푸들', '포메라니안', '기타'] },
                validation: { required: true }
              }
            ]
          }
        ],
      });
    }
  }, [formFactor, setFormFactor]);

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
          padding: '40px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            {isReviewMode && (
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
            )}
          </div>
          <div style={{ 
            background: 'var(--f-surface)', 
            padding: '40px', 
            borderRadius: 'var(--f-radius-xl)',
            boxShadow: 'var(--f-shadow-premium)',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            border: isReviewMode ? '2px solid #22C55E' : '1px solid var(--f-border)',
            transition: 'all 0.3s ease',
            position: 'relative'
          }}>
            {/* Form Title and Description integrated into container */}
            <div 
              className={`${styles.metadataContainer} ${activeBlockId === 'form-metadata' && !isReviewMode ? styles.activeMetadata : ''}`}
              onClick={(e) => {
                if (isReviewMode) return; // Disable in review mode
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

            {activePage?.blocks.map((block: import('@/lib/core/schema').FormBlock) => (
              <BlockRenderer key={block.id} block={block} />
            ))}
            
            {/* Render new block previews from AI suggestions */}
            {newBlockPreviews.map((preview) => (
              <BlockRenderer 
                key={preview.targetBlockId} 
                block={preview.block} 
                previewBlockId={preview.targetBlockId}
              />
            ))}
            
            {(!activePage || activePage.blocks.length === 0) && newBlockPreviews.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--f-text-muted)', marginTop: '40px' }}>
                이 페이지에 아직 문항이 없습니다.
              </p>
            )}
          </div>

          {/* Floating Action Bar for History/Save */}
          <div className={styles.floatingActions}>
            <button onClick={undo} disabled={history.length === 0} className={styles.actionBtn} title="Undo">
              <Undo2 size={18} />
            </button>
            <button onClick={redo} disabled={future.length === 0} className={styles.actionBtn} title="Redo">
              <Redo2 size={18} />
            </button>
            <div className={styles.vDivider} />
            <button className={styles.saveBtn}>
              <Save size={16} /> 적용하기
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
