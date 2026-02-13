'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useFormStore } from '@/store/useFormStore';

export default function RedirectToPreview() {
  const router = useRouter();
  const { formId } = useFormStore();

  useEffect(() => {
    router.replace(`/preview/${formId || 'draft'}`);
  }, [router, formId]);

  return null;
}
