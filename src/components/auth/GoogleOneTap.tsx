'use client';

import { useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';

export const GoogleOneTap = () => {
  const { data: session, status } = useSession();

  useEffect(() => {
    console.log('[OneTap] Status:', status);
    if (status !== 'unauthenticated') {
      console.log('[OneTap] Skipping because user is not unauthenticated');
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('[OneTap] NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing!');
      return;
    }

    // Load Google GIS script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      console.log('[OneTap] Script loaded');
      if (window.google) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              console.log('[OneTap] Success callback received');
              await signIn('google', {
                credential: response.credential,
                redirect: true,
                callbackUrl: '/',
              });
            },
            error_callback: (err: any) => {
              console.error('[OneTap] Library Error:', err);
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            /**
             * TODO: Production 배포 시 FedCM 활성화 검토
             * - FedCM은 최신 브라우저 표준으로, 제3자 쿠키 없이도 안전한 인증을 제공합니다.
             * - 활성화하려면 아래 use_fedcm_for_prompt를 true로 변경하세요.
             * - 단, 서버 루트에 /.well-known/gpc-configuration 및 관련 설정 파일이 필요할 수 있습니다.
             * - 상세 가이드: https://developers.google.com/identity/gsi/web/guides/fedcm-migration
             */
            use_fedcm_for_prompt: false, 
          });

          console.log('[OneTap] Prompting...');
          window.google.accounts.id.prompt((notification: any) => {
            console.log('[OneTap] Notification:', notification.getMomentType(), notification.getNotDisplayedReason() || 'Displayed');
            
            if (notification.isNotDisplayed()) {
              const reason = notification.getNotDisplayedReason();
              console.warn(`[OneTap] Not displayed reason: ${reason}`);
              if (reason === 'suppressed_by_user') {
                console.info('Tip: Clear "g_state" cookie and refresh.');
              }
            }
          });
        } catch (e) {
          console.error('[OneTap] Initialization failed:', e);
        }
      }
    };

    return () => {
      const scriptTag = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (scriptTag) document.body.removeChild(scriptTag);
    };
  }, [status]);

  return <div id="g_id_onload" style={{ display: 'none' }} />;
};

// Add type definition for global window.google
declare global {
  interface Window {
    google: any;
  }
}
