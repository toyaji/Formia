'use client';

import { useEffect } from 'react';
import styles from './page.module.css';
import { useFormStore } from '@/store/useFormStore';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { Sidebar } from '@/components/layout/Sidebar';

export default function Home() {
  const { formFactor, setFormFactor } = useFormStore();

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
    <main className={styles.container}>
      {/* Left Sidebar: Structure & Navigation */}
      <aside className={styles.leftPanel}>
        <div className={styles.header}>
          <span className={styles.title}>Structure</span>
        </div>
        <Sidebar />
      </aside>

      {/* Center Canvas: WYSIWYG Builder */}
      <section className={styles.centerCanvas}>
        <div style={{ maxWidth: '600px', width: '100%' }}>
          <h1 style={{ marginBottom: '40px', textAlign: 'center' }}>
            {formFactor?.metadata.title}
          </h1>
          
          <div style={{ 
            background: 'var(--f-surface)', 
            padding: '40px', 
            borderRadius: 'var(--f-radius-xl)',
            boxShadow: 'var(--f-shadow-premium)',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px'
          }}>
            {formFactor?.blocks.map((block: import('@/lib/core/schema').FormBlock) => (
              <BlockRenderer key={block.id} block={block} />
            ))}
            
            {formFactor?.blocks.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--f-text-muted)' }}>
                이곳이 폼 빌더 캔버스입니다.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Right Sidebar: AI Agent Panel */}
      <aside className={styles.rightPanel}>
        <div className={styles.header}>
          <span className={styles.title}>Formia AI</span>
        </div>
        <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
            <div style={{ 
              background: 'var(--f-background)', 
              padding: '12px', 
              borderRadius: 'var(--f-radius-md)',
              fontSize: '0.9rem',
              border: '1px solid var(--f-border)'
            }}>
              안녕하세요! 어떤 폼을 만들고 싶으신가요?
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="여기에 요청하세요..." 
              style={{ 
                flex: 1, 
                padding: '10px', 
                borderRadius: 'var(--f-radius-sm)', 
                border: '1px solid var(--f-border)' 
              }}
            />
            <button style={{ 
              background: 'var(--f-primary)', 
              color: 'white', 
              padding: '10px 16px', 
              borderRadius: 'var(--f-radius-sm)',
              fontWeight: 600
            }}>
              보내기
            </button>
          </div>
        </div>
      </aside>
    </main>
  );
}
