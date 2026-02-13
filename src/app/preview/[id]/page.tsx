'use client';

import { useFormStore } from '@/store/useFormStore';
import { FormViewer } from '@/components/viewer/FormViewer';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getDefaultForm } from '@/lib/constants/defaultForm';

export default function PreviewPage() {
  const { formFactor, formId, loadFormById, initApp, setFormFactor } = useFormStore();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // 1. If we have the factor already and it matches the ID (or it's a draft), no need to load
        if (formFactor && (formId === id || id === 'draft')) {
          setIsInitializing(false);
          return;
        }

        // 2. If ID is provided and different, load it
        if (id && id !== 'draft' && id !== 'new') {
          try {
            await loadFormById(id);
          } catch (e) {
            console.error('Failed to load form for preview:', e);
            // Fallback to general init
            await initApp();
          }
        } else {
          // 3. General init if no ID or draft
          await initApp();
        }
        
        // Final fallback: if after all attempts formFactor is still null and we are in draft mode,
        // use the default form to avoid infinite loading
        if (!useFormStore.getState().formFactor && (id === 'draft' || id === 'new')) {
          setFormFactor(getDefaultForm());
        } else if (!useFormStore.getState().formFactor) {
          setError('설문을 정보를 불러올 수 없습니다. 설문이 존재하지 않거나 삭제되었을 수 있습니다.');
        }
      } catch (err) {
        console.error('Preview initialization error:', err);
        setError('초기화 중 오류가 발생했습니다.');
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, [id, formId, formFactor, loadFormById, initApp, setFormFactor]);

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f8fafc',
        color: '#64748b',
        gap: '24px',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 500, color: '#1e293b' }}>{error}</div>
        <button 
          onClick={() => router.push('/')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  if (isInitializing || !formFactor) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f8fafc',
        color: '#64748b',
        gap: '16px'
      }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid #e2e8f0', 
          borderTopColor: '#2563eb', 
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        Loading Preview...
      </div>
    );
  }

  return (
    <FormViewer 
      formFactor={formFactor} 
      isPreview={true} 
      onClose={() => router.push('/')} 
    />
  );
}
