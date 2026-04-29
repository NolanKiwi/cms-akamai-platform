'use client';

import { useEffect } from 'react';
import { AUTH_EVENT } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

export function SessionToastBridge() {
  const toast = useToast();

  useEffect(() => {
    function onExpired() {
      toast.error('Session expired', 'Redirecting to sign in…');
    }
    window.addEventListener(AUTH_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EVENT, onExpired);
  }, [toast]);

  return null;
}
