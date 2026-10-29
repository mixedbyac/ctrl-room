'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Your profile now lives in Settings.
export default function ProfileRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings?tab=profile'); }, [router]);
  return null;
}
