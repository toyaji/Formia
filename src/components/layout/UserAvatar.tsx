'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { User, LogOut, LogIn, Settings as SettingsIcon } from 'lucide-react';
import styles from './UserAvatar.module.css';

export const UserAvatar = () => {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (status === 'loading') {
    return <div className={styles.avatarBtn} style={{ opacity: 0.5 }} />;
  }

  const authenticated = status === 'authenticated' && session;
  const user = session?.user;

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button 
        className={styles.avatarBtn} 
        onClick={() => setIsOpen(!isOpen)}
        title={authenticated ? (user?.name || '사용자 메뉴') : '로그인'}
      >
        {authenticated && user?.image ? (
          <img src={user.image} alt={user.name || 'User'} className={styles.avatarImg} />
        ) : (
          <User size={18} className={styles.placeholder} />
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {authenticated ? (
            <>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user?.name}</span>
                <span className={styles.userEmail}>{user?.email}</span>
              </div>
              <button className={styles.menuItem}>
                <SettingsIcon size={14} /> 프로필 설정
              </button>
              <button 
                className={`${styles.menuItem} ${styles.logoutItem}`}
                onClick={() => {
                  setIsOpen(false);
                  signOut();
                }}
              >
                <LogOut size={14} /> 로그아웃
              </button>
            </>
          ) : (
            <>
              <div className={styles.userInfo}>
                <span className={styles.userName}>게스트</span>
                <span className={styles.userEmail}>로그인이 필요합니다</span>
              </div>
              <Link 
                href="/login" 
                className={styles.menuItem}
                onClick={() => setIsOpen(false)}
              >
                <LogIn size={14} /> 로그인
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
};
