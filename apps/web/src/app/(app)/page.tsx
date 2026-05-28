'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Pill,
  Users,
  Bell,
  Wallet,
  User as UserIcon,
  Plus,
  ChevronRight,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { fmtINR, fmtDateShort, dueLabel, fmtRelative } from '@/lib/format';
import type { Customer, Payment, User } from '@/lib/types';

interface Summary {
  kpis: {
    totalCustomers: number;
    remindersDue: number;
    moneyReceivedThisMonth: number;
    moneyGivenThisMonth: number;
    totalMedicines: number;
    addedFromBill: number;
    dueToday: number;
    due2Days: number;
    pendingEmployees: number;
  };
  remindersPreview: Customer[];
  recentPayments: (Payment & { customerId?: { _id: string; name?: string } | string | null })[];
  pendingEmployeeRequests: User[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<Summary>('/dashboard/summary');
      setSummary(data);
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Failed to load dashboard', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    setActioning(id);
    try {
      await api(`/employees/${id}/approve`, { method: 'POST' });
      toast({ message: 'Employee approved', tone: 'success' });
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Action failed', tone: 'danger' });
    } finally {
      setActioning(null);
    }
  }
  async function reject(id: string) {
    setActioning(id);
    try {
      await api(`/employees/${id}/reject`, { method: 'POST' });
      toast({ message: 'Request rejected', tone: 'success' });
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Action failed', tone: 'danger' });
    } finally {
      setActioning(null);
    }
  }

  if (loading || !summary || !user) {
    return <div className="text-[13px] text-[var(--muted)]">Loading dashboard…</div>;
  }

  const { kpis, remindersPreview, recentPayments, pendingEmployeeRequests } = summary;
  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';
  const eyebrow = `Today · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}`;
  const firstName = user.name.split(' ')[0];

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={`Good ${greeting}, ${firstName}`}
        subtitle="Here's what needs your attention today."
        actions={user.role === 'admin' && (
          <Link href="/customers"><Button icon={Plus}>Add customer</Button></Link>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Medicines" value={kpis.totalMedicines} sub={`${kpis.addedFromBill} added from bill`} icon={Pill} />
        <StatCard label="Active Customers" value={kpis.totalCustomers} sub={`${kpis.remindersDue} due in 48h`} icon={Users} />
        <StatCard
          label="Due Today"
          value={kpis.dueToday}
          sub={`${kpis.due2Days} due within 2 days`}
          icon={Bell}
          tone={kpis.dueToday > 0 ? 'warning' : 'neutral'}
        />
        {user.role === 'admin' ? (
          <StatCard
            label="Pending Approvals"
            value={kpis.pendingEmployees}
            sub={kpis.pendingEmployees > 0 ? 'Action required' : 'All staff approved'}
            icon={UserIcon}
            tone={kpis.pendingEmployees > 0 ? 'danger' : 'neutral'}
          />
        ) : (
          <StatCard
            label="Received this month"
            value={fmtINR(kpis.moneyReceivedThisMonth)}
            sub={`${fmtINR(kpis.moneyGivenThisMonth)} given`}
            icon={Wallet}
            tone="success"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
            <div>
              <div className="text-[14px] font-semibold text-[var(--ink)]">Refills due soon</div>
              <div className="text-[12px] text-[var(--muted)]">Customers due within 2 days</div>
            </div>
            <Link href="/reminders" className="text-[12.5px] text-[var(--brand-700)] hover:underline flex items-center gap-1">
              View all <ChevronRight size={12} strokeWidth={1.8} />
            </Link>
          </div>
          {remindersPreview.length === 0 ? (
            <EmptyState icon={Bell} title="Nothing due in the next 2 days" body="Reminders will surface here automatically." />
          ) : (
            <ul>
              {remindersPreview.map((c, i) => {
                const { label, tone } = dueLabel(c.nextDueDate);
                return (
                  <li
                    key={c._id}
                    className={`flex items-center gap-3 px-5 py-3 ${i < remindersPreview.length - 1 ? 'border-b border-[var(--border)]' : ''}`}
                  >
                    <Avatar name={c.name} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[var(--ink)] truncate">{c.name}</div>
                      <div className="text-[12px] text-[var(--muted)] truncate">
                        {c.medicines.map(m => m.medicineName).join(', ')}
                      </div>
                    </div>
                    <Badge tone={tone} dot>{label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-white border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
            <div>
              <div className="text-[14px] font-semibold text-[var(--ink)]">Recent payments</div>
              <div className="text-[12px] text-[var(--muted)]">Manual ledger</div>
            </div>
            <Link href="/payments" className="text-[12.5px] text-[var(--brand-700)] hover:underline flex items-center gap-1">
              All <ChevronRight size={12} strokeWidth={1.8} />
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <EmptyState icon={Wallet} title="No payments yet" />
          ) : (
            <ul>
              {recentPayments.map((p, i) => {
                const cust = typeof p.customerId === 'object' && p.customerId !== null ? p.customerId : null;
                const name = cust?.name || p.walkInName || '—';
                return (
                  <li
                    key={p._id}
                    className={`flex items-center gap-3 px-5 py-3 ${i < recentPayments.length - 1 ? 'border-b border-[var(--border)]' : ''}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center ${
                        p.type === 'received'
                          ? 'bg-[color-mix(in_oklab,var(--success)_12%,transparent)] text-[var(--success-ink)]'
                          : 'bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] text-[var(--danger-ink)]'
                      }`}
                    >
                      {p.type === 'received' ? <ArrowDown size={12} strokeWidth={1.8} /> : <ArrowUp size={12} strokeWidth={1.8} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">{name}</div>
                      <div className="text-[11.5px] text-[var(--muted)]">{fmtDateShort(p.date)}</div>
                    </div>
                    <div
                      className={`text-[13px] font-semibold tabular-nums ${
                        p.type === 'received' ? 'text-[var(--success-ink)]' : 'text-[var(--danger-ink)]'
                      }`}
                    >
                      {p.type === 'received' ? '+' : '−'}{fmtINR(p.amount)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {user.role === 'admin' && pendingEmployeeRequests.length > 0 && (
        <div className="mt-6 bg-white border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
            <div>
              <div className="text-[14px] font-semibold text-[var(--ink)]">Pending approvals</div>
              <div className="text-[12px] text-[var(--muted)]">Employee signup requests waiting on you</div>
            </div>
            <Link href="/employees" className="text-[12.5px] text-[var(--brand-700)] hover:underline flex items-center gap-1">
              Manage <ChevronRight size={12} strokeWidth={1.8} />
            </Link>
          </div>
          <ul>
            {pendingEmployeeRequests.map((u, i) => (
              <li
                key={u._id}
                className={`flex items-center gap-3 px-5 py-3 ${i < pendingEmployeeRequests.length - 1 ? 'border-b border-[var(--border)]' : ''}`}
              >
                <Avatar name={u.name} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--ink)] truncate">{u.name}</div>
                  <div className="text-[11.5px] text-[var(--muted)] truncate">
                    {u.email} · {u.phone} · requested {fmtRelative(u.createdAt)}
                  </div>
                </div>
                <Button size="sm" variant="success" disabled={actioning === u._id} onClick={() => approve(u._id)}>Approve</Button>
                <Button size="sm" variant="secondary" disabled={actioning === u._id} onClick={() => reject(u._id)}>Reject</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
