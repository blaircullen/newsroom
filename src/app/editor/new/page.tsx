'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewEditorRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/editor');
  }, [router]);

  // Return null while redirecting
  return null;
}
