'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/AppShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-[13px] text-[var(--muted)]">
        Loading…
      </div>
    );
  }
  if (!user) return null;
  return <AppShell>{children}</AppShell>;
}
