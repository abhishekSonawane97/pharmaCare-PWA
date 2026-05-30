'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Pill,
  Users,
  Bell,
  Wallet,
  User as UserIcon,
  Menu,
  ChevronRight,
  LogOut,
  Settings as SettingsIcon,
  Activity as ActivityIcon,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Logomark, Wordmark } from './Logomark';
import { Badge } from './Badge';
import { api } from '@/lib/api';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/medicines', label: 'Medicines', icon: Pill },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/reminders', label: 'Reminders', icon: Bell },
  { href: '/payments', label: 'Payments', icon: Wallet },
  { href: '/employees', label: 'Employees', icon: UserIcon, adminOnly: true },
  { href: '/activity', label: 'Activity', icon: ActivityIcon, adminOnly: true },
  { href: '/settings', label: 'Settings', icon: SettingsIcon, adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false); // desktop only
  const [mobileOpen, setMobileOpen] = useState(false); // mobile drawer
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let alive = true;
    (async () => {
      try {
        const data = await api<{ kpis: { pendingEmployees: number } }>('/dashboard/summary');
        if (alive) setPendingCount(data.kpis.pendingEmployees || 0);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [user, pathname]);

  // Close drawer when route changes
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function handleMenuClick() {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      setCollapsed(c => !c);
    } else {
      setMobileOpen(o => !o);
    }
  }

  if (!user) return null;

  const visible = NAV.filter(n => !n.adminOnly || user.role === 'admin');
  const activeLabel = visible.find(n =>
    n.href === '/' ? pathname === '/' : pathname?.startsWith(n.href)
  )?.label ?? (pathname?.startsWith('/customers/') ? 'Customer profile' : 'PharmaCare');

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Mobile backdrop — only visible while drawer is open */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[rgba(14,27,34,0.45)] md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:relative inset-y-0 left-0 z-40 shrink-0 border-r border-[var(--border)] bg-white flex flex-col transform transition-transform duration-200 md:transition-[width] md:transform-none
          w-full max-w-[320px]
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          ${collapsed ? 'md:w-[68px]' : 'md:w-[232px]'}
          md:max-w-none`}
      >
        <div className={`h-[60px] border-b border-[var(--border)] flex items-center ${collapsed ? 'md:justify-center' : ''} px-4 md:px-4 ${collapsed ? 'md:px-0' : ''}`}>
          {collapsed ? <Logomark size={28} /> : <Wordmark size={28} />}
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg-soft)] transition-colors"
            aria-label="Close menu"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
        <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
          {visible.map(n => {
            const isActive = n.href === '/'
              ? pathname === '/'
              : (pathname === n.href || pathname?.startsWith(n.href + '/'));
            const showBadge = n.href === '/employees' && pendingCount > 0;
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 ${collapsed ? 'md:justify-center md:px-0' : ''} h-9 rounded-md text-[13px] font-medium transition-colors relative ${
                  isActive ? 'bg-[var(--brand-50)] text-[var(--brand-800)]' : 'text-[var(--ink-2)] hover:bg-[var(--bg-soft)]'
                }`}
              >
                <Icon size={15} strokeWidth={1.7} />
                <span className={`flex-1 ${collapsed ? 'md:hidden' : ''}`}>{n.label}</span>
                {showBadge && (
                  <>
                    <span className={`min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--danger)] text-white text-[10.5px] font-medium flex items-center justify-center ${collapsed ? 'md:hidden' : ''}`}>
                      {pendingCount}
                    </span>
                    {collapsed && (
                      <span className="hidden md:block absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--danger)]" />
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-2 flex flex-col gap-1">
          <div className={`flex items-center gap-2.5 p-2 rounded-md ${collapsed ? 'md:hidden' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">{user.name}</div>
              <div className="text-[11px] text-[var(--muted)] capitalize">{user.role}</div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            title={collapsed ? 'Log out' : undefined}
            className={`flex items-center gap-2.5 px-3 ${collapsed ? 'md:justify-center md:px-0' : ''} h-9 rounded-md text-[13px] font-medium text-[var(--danger-ink)] border bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] border-[color-mix(in_oklab,var(--danger)_22%,transparent)] hover:bg-[var(--danger)] hover:text-white hover:border-[var(--danger)] transition-colors`}
          >
            <LogOut size={14} strokeWidth={1.8} />
            <span className={`flex-1 text-left ${collapsed ? 'md:hidden' : ''}`}>Log out</span>
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-[60px] border-b border-[var(--border)] bg-white px-3 md:px-5 flex items-center gap-2 md:gap-3">
          <button
            onClick={handleMenuClick}
            className="text-[var(--muted)] hover:text-[var(--ink)] -ml-1 p-1.5 rounded hover:bg-[var(--bg-soft)]"
            aria-label="Toggle sidebar"
          >
            <Menu size={16} strokeWidth={1.8} />
          </button>
          <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--muted)] min-w-0">
            <span className="hidden sm:inline">PharmaCare</span>
            <ChevronRight size={11} strokeWidth={1.8} className="hidden sm:inline shrink-0" />
            <span className="text-[var(--ink)] font-medium truncate">{activeLabel}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge tone={user.role === 'admin' ? 'brand' : 'neutral'} dot>
              <span className="hidden sm:inline">Viewing as </span>{user.role}
            </Badge>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto px-4 py-5 md:px-7 md:py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
