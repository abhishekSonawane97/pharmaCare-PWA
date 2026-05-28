'use client';

import { useEffect, useState } from 'react';
import { Activity as ActivityIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { Avatar } from '@/components/Avatar';
import { Select } from '@/components/Input';
import { fmtRelative, fmtDate } from '@/lib/format';
import type { ActivityLog } from '@/lib/types';

const ACTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All actions' },
  { value: 'reminder.auto_sent', label: 'Reminder auto-sent' },
  { value: 'reminder.manual_sent', label: 'Reminder manual-sent' },
  { value: 'reminder.complete', label: 'Reminder complete' },
  { value: 'customer.create', label: 'Customer created' },
  { value: 'customer.update', label: 'Customer updated' },
  { value: 'customer.due_date_update', label: 'Due date updated' },
  { value: 'customer.delete', label: 'Customer removed' },
  { value: 'customer.ignore', label: 'Customer ignored' },
  { value: 'customer.unignore', label: 'Customer unignored' },
  { value: 'auth.signup', label: 'Signup' },
  { value: 'auth.approved', label: 'Employee approved' },
  { value: 'auth.rejected', label: 'Employee rejected' },
  { value: 'auth.removed', label: 'Employee removed' },
  { value: 'payment.create', label: 'Payment recorded' },
  { value: 'payment.delete', label: 'Payment deleted' },
  { value: 'medicine.create', label: 'Medicine added' },
  { value: 'medicine.update', label: 'Medicine updated' },
  { value: 'medicine.delete', label: 'Medicine deleted' },
  { value: 'settings.update', label: 'Settings updated' },
];

const ACTION_TONE: Record<string, 'brand' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  'reminder.auto_sent': 'success',
  'reminder.manual_sent': 'success',
  'reminder.complete': 'brand',
  'reminder.thank_you_sent': 'success',
  'customer.create': 'brand',
  'customer.update': 'neutral',
  'customer.due_date_update': 'warning',
  'customer.delete': 'danger',
  'customer.ignore': 'warning',
  'customer.unignore': 'neutral',
  'auth.signup': 'neutral',
  'auth.approved': 'success',
  'auth.rejected': 'danger',
  'auth.removed': 'danger',
  'payment.create': 'success',
  'payment.delete': 'danger',
  'medicine.create': 'brand',
  'medicine.update': 'neutral',
  'medicine.delete': 'danger',
  'settings.update': 'brand',
};

function actionLabel(action: string): string {
  const found = ACTIONS.find(a => a.value === action);
  return found?.label || action;
}

function describe(a: ActivityLog): string {
  const target = a.targetName ? ` ${a.targetName}` : '';
  switch (a.action) {
    case 'reminder.auto_sent':   return `auto-sent reminder to${target}`;
    case 'reminder.manual_sent': return `sent reminder to${target}`;
    case 'reminder.complete':    return `marked${target} as complete`;
    case 'reminder.thank_you_sent': return `sent thank-you to${target}`;
    case 'customer.create':      return `added customer${target}`;
    case 'customer.update':      return `updated${target}`;
    case 'customer.due_date_update': return `updated due date for${target}`;
    case 'customer.delete':      return `removed${target}`;
    case 'customer.ignore':      return `ignored${target}`;
    case 'customer.unignore':    return `unignored${target}`;
    case 'auth.signup':          return `signed up${target ? ` as ${a.targetName}` : ''}`;
    case 'auth.approved':        return `approved${target}`;
    case 'auth.rejected':        return `rejected${target}`;
    case 'auth.removed':         return `removed employee${target}`;
    case 'payment.create':       return `recorded a ${a.metadata?.type || ''} payment${target ? ` for ${a.targetName}` : ''}`;
    case 'payment.delete':       return `deleted a payment record`;
    case 'medicine.create':      return `added medicine${target}`;
    case 'medicine.update':      return `updated medicine${target}`;
    case 'medicine.delete':      return `deleted medicine${target}`;
    case 'settings.update':      return `updated settings`;
    default:                     return a.action;
  }
}

export default function ActivityPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ activities: ActivityLog[] }>('/activity', { query: { action, limit: 200 } });
      setActivities(data.activities);
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Failed to load', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [action]);

  if (user?.role !== 'admin') {
    return <EmptyState icon={ActivityIcon} title="Admin only" body="You don't have access to this page." />;
  }

  return (
    <div>
      <PageHeader title="Activity log" subtitle="Append-only audit trail of every action taken in the system" />

      <div className="bg-white border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-[var(--border)] md:flex-row md:items-center">
          <Select value={action} onChange={e => setAction(e.target.value)} className="w-full md:w-[220px]">
            {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </Select>
          <div className="md:ml-auto text-[12px] text-[var(--muted)]">{activities.length} entries</div>
        </div>

        {loading ? (
          <div className="p-6 text-[13px] text-[var(--muted)]">Loading…</div>
        ) : activities.length === 0 ? (
          <EmptyState icon={ActivityIcon} title="No activity yet" body="Actions taken in the app will be logged here." />
        ) : (
          <ul>
            {activities.map((a, i) => (
              <li
                key={a._id}
                className={`flex items-start gap-3 px-5 py-3 ${i < activities.length - 1 ? 'border-b border-[var(--border)]' : ''}`}
              >
                <Avatar name={a.actorName || 'System'} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[var(--ink)]">
                    <span className="font-medium">{a.actorName || 'System'}</span>{' '}
                    <span className="text-[var(--ink-2)]">{describe(a)}</span>
                  </div>
                  <div className="text-[11.5px] text-[var(--muted)] mt-0.5">
                    {fmtDate(a.createdAt)} · {fmtRelative(a.createdAt)}
                  </div>
                </div>
                <Badge tone={ACTION_TONE[a.action] || 'neutral'}>{actionLabel(a.action)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
