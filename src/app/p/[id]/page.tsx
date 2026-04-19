'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FormViewer } from '@/components/viewer/FormViewer';
import { FormFactor } from '@/lib/core/schema';

/**
 * PublicFormPage (나타내기 설문 참여 페이지)
 * 고유한 shortId를 통해 설문을 렌더링하고 응답을 수집합니다.
 */
export default function PublicFormPage() {
  const params = useParams();
  const shortId = params.id as string;
  const [formFactor, setFormFactor] = useState<FormFactor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const res = await fetch(`/api/p/${shortId}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || '설문을 불러올 수 없습니다.');
        }
        const data = await res.json();
        setFormFactor(data.factor);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (shortId) {
      fetchForm();
    }
  }, [shortId]);

  const handleSubmit = async (responses: Record<string, any>) => {
    try {
      const res = await fetch(`/api/p/${shortId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: responses,
          metadata: {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            submittedAt: new Date().toISOString()
          }
        })
      });

      if (!res.ok) {
        throw new Error('응답 저장에 실패했습니다.');
      }
      return true;
    } catch (err) {
      console.error('Submission error:', err);
      throw err;
    }
  };

  if (loading) {
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
        설문을 불러오는 중입니다...
      </div>
    );
  }

  if (error || !formFactor) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f8fafc',
        color: '#1e293b',
        gap: '24px',
        padding: '20px',
        textAlign: 'center',
        fontFamily: 'Pretendard, system-ui, sans-serif'
      }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
          {error || '설문을 찾을 수 없습니다.'}
        </div>
        <p style={{ color: '#64748b', maxWidth: '400px' }}>
          링크가 올바른지 확인하거나, 이미 종료된 설문일 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <FormViewer 
        formFactor={formFactor} 
        onSubmit={handleSubmit}
        isPreview={false}
      />
    </div>
  );
}
