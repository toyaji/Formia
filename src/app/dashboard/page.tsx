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
import { useRef } from 'react';

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { 
    formsList, 
    isLoadingForms, 
    loadAllForms, 
    setSession,
    setFormId,
    setFormFactor,
    exportFormById,
    importForm,
    deleteForm
  } = useFormStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchTerm) {
      setDebouncedSearchTerm('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 400); 
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    setSession(session);
    loadAllForms();
  }, [session, loadAllForms, setSession]);

  const filteredForms = formsList.filter(form => 
    form.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  );

  const handleCreateNew = () => {
    const newId = `form_${Date.now()}`;
    setFormId(newId);
    setFormFactor({
      version: '1.0',
      metadata: {
        title: 'Formia 설문지',
        description: '앞으로 AI Agent가 당신의 설문을 만들어 드립니다.',
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
          description: '앞으로 AI Agent가 당신의 설문을 만들어 드립니다.',
          blocks: [
            {
              id: 'start-block-1',
              type: 'statement',
              content: {
                label: 'Formia 설문지',
                body: '앞으로 AI Agent가 당신의 설문을 만들어 드립니다.',
              },
              removable: true
            },
            {
              id: 'q1',
              type: 'text',
              content: {
                label: '이름을 입력해 주세요.',
                placeholder: '예: 홍길동'
              },
              validation: { required: true },
              removable: true
            },
            {
              id: 'q2',
              type: 'choice',
              content: {
                label: '신청 경로를 선택해 주세요.',
                options: ['지인 추천', 'SNS 광고', '검색 엔진', '기타']
              },
              removable: true
            }
          ],
          removable: false
        },
        questions: [],
        endings: [
          {
            id: 'end',
            type: 'ending',
            title: '완료 페이지',
            blocks: [
              {
                id: 'end-block-1',
                type: 'statement',
                content: {
                  label: '신청이 완료되었습니다.',
                  body: '빠른 시일 내에 확인 후 연락드리겠습니다. 감사합니다!'
                },
                removable: true
              }
            ],
            removable: true
          }
        ]
      }
    });
    router.push('/');
  };

  const handleLoadForm = (id: string) => {
    setFormId(id);
    router.push('/');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.formia')) {
      alert('.formia 파일만 가져올 수 있습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const factor = JSON.parse(e.target?.result as string);
        await importForm(factor);
      } catch (err) {
        console.error('Import failed:', err);
        alert('올바른 .formia 파일이 아닙니다.');
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className={styles.container}>
      {/* Simple Top Nav */}
      <nav style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/" className={styles.logoLink}>
            <span className={styles.logo}>Formia</span>
          </Link>
          <div style={{ height: '20px', width: '1px', background: '#e2e8f0' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4a5568' }}>
            {session?.user?.name ? `${session.user.name}의 워크스페이스` : '워크스페이스'}
          </span>
        </div>
      </nav>

      <main className={styles.content}>
        <div className={styles.filterBar}>
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
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className={styles.importBtn} onClick={() => fileInputRef.current?.click()}>
              <Upload size={18} />
              <span>가져오기</span>
            </button>
            <button className={styles.createBtn} onClick={handleCreateNew}>
              <Plus size={18} />
              <span>새 폼 만들기</span>
            </button>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".formia" 
            style={{ display: 'none' }} 
          />
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
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
                        <button 
                          className={styles.actionBtn} 
                          title="내보내기"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportFormById(form.id);
                            setActiveMenuId(null);
                          }}
                        >
                          <Download size={16} />
                        </button>
                        <button 
                          className={`${styles.actionBtn} ${activeMenuId === form.id ? styles.active : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === form.id ? null : form.id);
                          }}
                        >
                          <MoreHorizontal size={18} />
                        </button>

                        {activeMenuId === form.id && (
                          <div className={styles.dropdownMenu}>
                            {/* TODO: 게시하기 기능 구현 (추후 개발 예정) */}
                            <button 
                              className={styles.dropdownItem}
                              onClick={(e) => {
                                e.stopPropagation();
                                alert('준비 중인 기능입니다.');
                                setActiveMenuId(null);
                              }}
                            >
                              <ExternalLink size={16} />
                              <span>게시하기</span>
                            </button>
                            <button 
                              className={`${styles.dropdownItem} ${styles.delete}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteForm(form.id);
                                setActiveMenuId(null);
                              }}
                            >
                              <Trash2 size={16} />
                              <span>삭제하기</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div 
          className={`${styles.importArea} ${isDragging ? styles.active : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload size={40} className={styles.importIcon} strokeWidth={1.5} />
          <h3 className={styles.importTitle}>외부 .formia 파일 가져오기</h3>
          <p className={styles.importDescription}>
            컴퓨터에 저장된 설문 파일을 이 영역으로 드래그하거나<br />
            클릭하여 워크스페이스에 즉시 추가할 수 있습니다.
          </p>
          <button className={styles.importActionBtn}>
            파일 선택하기
          </button>
        </div>
      </main>
    </div>
  );
}
