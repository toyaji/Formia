'use client';

import { useEffect } from 'react';
import styles from './page.module.css';
import { useFormStore } from '@/store/useFormStore';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { Sidebar } from '@/components/layout/Sidebar';
import { AiPanel } from '@/components/ai/AiPanel';
import { Header } from '@/components/layout/Header';

export default function Home() {
  const { formFactor, setFormFactor, getEffectiveFactor, proposedPatches } = useFormStore();
  const effectiveFactor = getEffectiveFactor();

  // Initialize with a default schema for testing
  useEffect(() => {
    if (!formFactor) {
      setFormFactor({
        version: '1.0.0',
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
        <div style={{ maxWidth: '600px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            {proposedPatches && (
              <span style={{ 
                fontSize: '0.7rem', 
                background: 'var(--f-primary)', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '10px',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}>
                Preview Mode
              </span>
            )}
          </div>
          <h1 style={{ marginBottom: '40px', textAlign: 'center' }}>
            {effectiveFactor?.metadata.title}
          </h1>
          
          <div style={{ 
            background: 'var(--f-surface)', 
            padding: '40px', 
            borderRadius: 'var(--f-radius-xl)',
            boxShadow: 'var(--f-shadow-premium)',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            border: proposedPatches ? '2px solid var(--f-primary)' : 'none',
            transition: 'all 0.3s ease'
          }}>
            {effectiveFactor?.blocks.map((block: import('@/lib/core/schema').FormBlock) => (
              <BlockRenderer key={block.id} block={block} />
            ))}
            
            {effectiveFactor?.blocks.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--f-text-muted)' }}>
                이곳이 폼 빌더 캔버스입니다.
              </p>
            )}
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
