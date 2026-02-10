'use client';

import { signIn } from 'next-auth/react';
import styles from './login.module.css';
import Image from 'next/image';

export default function LoginPage() {
  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>Formia</div>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>로그인하거나 계정을 만들어<br />협업하세요</h1>
          
          <button className={styles.googleBtn} onClick={handleGoogleSignIn}>
            <img 
              src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" 
              alt="Google" 
              className={styles.googleIcon}
            />
            Google 계정으로 계속하기
          </button>

          <p className={styles.helperText}>
            현재는 Google 계정을 통한 로그인만 지원합니다.
          </p>
        </div>
      </main>

      <footer className={styles.footer}>
        <p className={styles.footerText}>© {new Date().getFullYear()} Formia. All rights reserved.</p>
      </footer>
    </div>
  );
}
