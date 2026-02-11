'use client';

import { useEffect, useState } from 'react';
import { useFormStore } from '@/store/useFormStore';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Download, 
  Upload, 
  ArrowLeft,
  Calendar,
  User,
  ExternalLink,
  Trash2,
  FileText
} from 'lucide-react';
import styles from './Dashboard.module.css';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { 
    formsList, 
    isLoadingForms, 
    loadAllForms, 
    setSession,
    setFormId,
    setFormFactor 
  } = useFormStore();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSession(session);
    loadAllForms();
  }, [session, loadAllForms, setSession]);

  const filteredForms = formsList.filter(form => 
    form.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateNew = () => {
    const newId = `form_${Date.now()}`;
    setFormId(newId);
    setFormFactor({
      version: '1.0',
      metadata: {
        title: '새 설문',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      theme: {
        mode: 'light',
        tokens: {},
      },
      pages: {
        start: {
          id: 'start',
          type: 'start',
          title: '시작 페이지',
          blocks: [],
          removable: false
        },
        questions: [],
        endings: []
      }
    });
    router.push('/');
  };

  const handleLoadForm = (id: string) => {
    setFormId(id);
    router.push('/');
  };

  return (
    <div className={styles.container}>
      {/* Simple Top Nav */}
      <nav style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '1.2rem', color: '#1a1a1a' }}>
            <span style={{ color: '#00c853' }}>Formia</span>
          </Link>
          <div style={{ height: '20px', width: '1px', background: '#e2e8f0' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4a5568' }}>워크스페이스</span>
        </div>
      </nav>

      <main className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <h1>신바울의 워크스페이스</h1>
          </div>
          <button className={styles.createBtn} onClick={handleCreateNew}>
            <Plus size={20} />
            <span>새 신청 폼 만들기</span>
          </button>
        </div>

        <div className={styles.filterBar}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${styles.active}`}>전체 {formsList.length}</button>
            <button className={styles.tab}>작성 중</button>
            <button className={styles.tab}>진행 중</button>
            <button className={styles.tab}>휴지통</button>
          </div>
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="신청 폼 제목을 입력해 주세요." 
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '100px' }}>상태</th>
                <th>제목</th>
                <th>수정된 날짜</th>
                <th>마지막 편집한 사람</th>
                <th style={{ textAlign: 'right' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredForms.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className={styles.emptyState}>
                      <FileText size={48} strokeWidth={1} />
                      <p>{searchTerm ? '검색 결과가 없습니다.' : '생성된 폼이 없습니다.'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredForms.map(form => (
                  <tr key={form.id} className={styles.formRow} onClick={() => handleLoadForm(form.id)}>
                    <td>
                      <span className={styles.statusBadge}>진행 중</span>
                    </td>
                    <td>
                      <div className={styles.formTitleCell}>
                        <span className={styles.formTitle}>{form.title}</span>
                        <span className={styles.formMeta}>{form.id}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#4a5568' }}>
                        <Calendar size={14} />
                        {format(new Date(form.updatedAt), 'yyyy.MM.dd HH:mm')}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#4a5568' }}>
                        <User size={14} />
                        {session?.user?.name || (typeof window !== 'undefined' && (window as any).__TAURI__ ? 'Local User' : 'Guest')}
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className={styles.actions}>
                        <button className={styles.actionBtn} title="내보내기">
                          <Download size={16} />
                        </button>
                        <button className={styles.actionBtn}>
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Import Area */}
        <div style={{ marginTop: '40px', padding: '24px', border: '2px dashed #e2e8f0', borderRadius: '12px', textAlign: 'center' }}>
          <Upload size={32} style={{ color: '#a0aec0', marginBottom: '12px' }} />
          <h3 style={{ marginBottom: '8px', fontWeight: 600 }}>외부 .formia 파일 가져오기</h3>
          <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: '16px' }}>
            컴퓨터에 저장된 설문 파일을 드래그하거나 선택하여 워크스페이스에 추가할 수 있습니다.
          </p>
          <button 
            style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600 }}
            onClick={() => alert('파일 선택 기능은 곧 구현됩니다.')}
          >
            파일 선택하기
          </button>
        </div>
      </main>
    </div>
  );
}
