'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  MessageCircle,
  MessageSquare,
  Search,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import { PushPermissionPrompt } from '@/components/PushPermissionPrompt';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Input, Field } from '@/components/Input';
import { fmtDate, fmtTime, dueLabel, toDateInputValue } from '@/lib/format';
import type { Customer, ReminderRow, ReminderLinks } from '@/lib/types';

interface RemindersResponse {
  reminders: ReminderRow[];
}

interface CompleteResponse {
  customer: Customer;
  thankYouLinks: ReminderLinks | null;
}

export default function RemindersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [completing, setCompleting] = useState<ReminderRow | null>(null);
  const [thankYou, setThankYou] = useState<{ customer: Customer; links: ReminderLinks } | null>(null);
  const [locallyMarked, setLocallyMarked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return reminders;
    return reminders.filter(c => {
      if (c.name.toLowerCase().includes(term)) return true;
      if (c.phone && c.phone.toLowerCase().includes(term)) return true;
      return c.medicines.some(m => m.medicineName.toLowerCase().includes(term));
    });
  }, [reminders, q]);

  async function load() {
    try {
      const data = await api<RemindersResponse>('/reminders');
      setReminders(data.reminders);
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Failed to load', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!menuOpenFor) return;
    const close = () => setMenuOpenFor(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpenFor]);

  // Fire-and-forget: tell backend the reminder went out via this channel.
  // The native app opens in parallel via the <a href>; we don't await the network.
  function handleSendClick(c: ReminderRow, channel: 'whatsapp' | 'sms') {
    setLocallyMarked(s => new Set([...s, c._id]));
    api(`/reminders/${c._id}/mark-sent`, { method: 'POST', body: { channel } }).catch(err => {
      toast({
        message: err instanceof ApiError ? `Mark-sent failed: ${err.message}` : 'Mark-sent failed',
        tone: 'danger',
      });
    });
  }

  async function ignore(c: ReminderRow) {
    try {
      await api(`/customers/${c._id}/ignore`, { method: 'POST' });
      toast({ message: `${c.name} removed from reminders · returns when due date is updated`, tone: 'success' });
      setMenuOpenFor(null);
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Ignore failed', tone: 'danger' });
    }
  }

  async function complete(c: ReminderRow, nextDueDate: string) {
    try {
      const data = await api<CompleteResponse>(`/reminders/${c._id}/complete`, {
        method: 'POST',
        body: { nextDueDate },
      });
      toast({ message: `${c.name} — refill complete`, tone: 'success' });
      setCompleting(null);
      if (data.thankYouLinks && (data.thankYouLinks.whatsappUrl || data.thankYouLinks.smsUrl)) {
        setThankYou({ customer: data.customer, links: data.thankYouLinks });
      }
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Complete failed', tone: 'danger' });
    }
  }

  if (user && user.role !== 'admin') {
    return <EmptyState icon={Bell} title="Admin only" body="You don't have access to this page." />;
  }

  if (loading) return <div className="text-[13px] text-[var(--muted)]">Loading reminders…</div>;

  return (
    <div>
      <PageHeader
        title="Reminders"
        subtitle="Customers due in the next 48 hours · tap to send via WhatsApp or SMS"
        actions={<Badge tone="brand" dot>{reminders.length} pending</Badge>}
      />

      <PushPermissionPrompt />

      {reminders.length === 0 ? (
        <EmptyState icon={Bell} title="All caught up" body="No customers due right now." />
      ) : (
        <>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1 sm:max-w-md">
            <Input
              icon={Search}
              placeholder="Search by name, phone or medicine…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <div className="text-[12px] text-[var(--muted)] sm:ml-auto">
            {q.trim() ? `${filtered.length} of ${reminders.length}` : `${reminders.length} pending`}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Bell} title="No matches" body="Try a different name, phone, or medicine." />
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(c => {
            const { label, tone } = dueLabel(c.nextDueDate);
            const markedHere = locallyMarked.has(c._id);
            const alreadySent = c.autoReminderSentForCycle || markedHere;
            const unreachable = !c.phone;
            return (
              <div key={c._id} className="bg-white border border-[var(--border)] rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={c.name} size={36} />
                    <div className="min-w-0">
                      <Link
                        href={`/customers/${c._id}`}
                        className="font-medium text-[var(--ink)] hover:underline truncate text-left"
                      >
                        {c.name}
                      </Link>
                      <div className="text-[12px] text-[var(--muted)] tabular-nums">{c.phone || '—'}</div>
                    </div>
                  </div>
                  <Badge tone={tone} dot>{label}</Badge>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.1em] font-medium text-[var(--muted)] mb-1.5">Medicines</div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.medicines.map((m, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center h-7 px-2.5 rounded-md bg-[var(--brand-50)] text-[var(--brand-800)] border border-[var(--brand-100)] text-[12.5px] font-medium"
                      >
                        {m.medicineName}
                      </span>
                    ))}
                    {c.medicines.length === 0 && (
                      <span className="text-[12px] text-[var(--muted)] italic">No medicines on file</span>
                    )}
                  </div>
                </div>

                {!unreachable && (
                  <div className="rounded-md bg-[var(--bg-soft)] border border-[var(--border)] p-2.5 text-[12px] text-[var(--ink-2)] leading-relaxed">
                    {c.links.message}
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-3 border-t border-[var(--border)] sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                  <div className="text-[11.5px] text-[var(--muted)] min-w-0 whitespace-nowrap">
                    {unreachable ? (
                      <span className="inline-flex items-center gap-1 text-[var(--danger-ink)]">
                        <AlertTriangle size={11} strokeWidth={1.8} /> Unreachable · no phone
                      </span>
                    ) : alreadySent ? (
                      <span className="inline-flex items-center gap-1 text-[var(--success-ink)]">
                        <Check size={11} strokeWidth={1.8} /> Marked sent · {c.autoReminderSentAt ? fmtTime(c.autoReminderSentAt) : 'just now'}
                      </span>
                    ) : (
                      <>
                        <span className="uppercase tracking-[0.08em]">Due</span> ·{' '}
                        <span className="text-[var(--ink-2)] tabular-nums">{fmtDate(c.nextDueDate)}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {!unreachable && (
                      <>
                        <a
                          href={c.links.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleSendClick(c, 'whatsapp')}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-md text-[12.5px] font-medium text-white bg-[#25D366] hover:bg-[#1ebd5a] transition-colors"
                        >
                          <MessageCircle size={13} strokeWidth={1.9} /> WhatsApp
                        </a>
                        <a
                          href={c.links.smsUrl}
                          onClick={() => handleSendClick(c, 'sms')}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-md text-[12.5px] font-medium text-white bg-[var(--brand-700)] hover:bg-[var(--brand-800)] transition-colors"
                        >
                          <MessageSquare size={13} strokeWidth={1.9} /> SMS
                        </a>
                      </>
                    )}
                    {user?.role === 'admin' && (
                      <div className="relative inline-flex">
                        <button
                          onClick={() => setCompleting(c)}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-l-md border border-r-0 border-[var(--border)] bg-white text-[12.5px] text-[var(--ink)] hover:bg-[var(--bg-soft)] transition-colors"
                        >
                          <Check size={13} strokeWidth={1.8} /> Mark complete
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setMenuOpenFor(menuOpenFor === c._id ? null : c._id);
                          }}
                          aria-label="More actions"
                          className="inline-flex items-center justify-center w-7 h-8 rounded-r-md border border-[var(--border)] bg-white text-[var(--ink-2)] hover:bg-[var(--bg-soft)] transition-colors"
                        >
                          <ChevronDown size={13} strokeWidth={1.8} />
                        </button>
                        {menuOpenFor === c._id && (
                          <div
                            onClick={e => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1 w-52 bg-white border border-[var(--border)] rounded-md shadow-lg z-20 overflow-hidden"
                          >
                            <button
                              onClick={() => { setMenuOpenFor(null); setCompleting(c); }}
                              className="w-full text-left px-3 py-2.5 text-[12.5px] hover:bg-[var(--bg-soft)] flex items-start gap-2.5"
                            >
                              <Check size={13} strokeWidth={1.8} className="mt-0.5 text-[var(--success-ink)]" />
                              <div>
                                <div className="font-medium text-[var(--ink)]">Mark complete</div>
                                <div className="text-[11px] text-[var(--muted)]">Customer purchased — set next due date</div>
                              </div>
                            </button>
                            <button
                              onClick={() => ignore(c)}
                              className="w-full text-left px-3 py-2.5 text-[12.5px] hover:bg-[var(--bg-soft)] border-t border-[var(--border)] flex items-start gap-2.5"
                            >
                              <Bell size={13} strokeWidth={1.8} className="mt-0.5 text-[var(--muted)]" />
                              <div>
                                <div className="font-medium text-[var(--ink)]">Ignore</div>
                                <div className="text-[11px] text-[var(--muted)]">Hide from reminders · keep due date</div>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
        </>
      )}

      <CompleteModal customer={completing} onClose={() => setCompleting(null)} onSave={complete} />
      <ThankYouModal data={thankYou} onClose={() => setThankYou(null)} />
    </div>
  );
}

function CompleteModal({
  customer,
  onClose,
  onSave,
}: {
  customer: ReminderRow | null;
  onClose: () => void;
  onSave: (c: ReminderRow, nextDueDate: string) => void;
}) {
  const [date, setDate] = useState('');

  useEffect(() => {
    if (customer) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setDate(toDateInputValue(d));
    }
  }, [customer]);

  if (!customer) return null;

  return (
    <Modal
      open={!!customer}
      onClose={onClose}
      title="Mark refill complete"
      subtitle={`Set ${customer.name}'s next due date`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="success"
            disabled={!date}
            onClick={() => {
              const dt = new Date(date);
              if (isNaN(dt.getTime())) return;
              onSave(customer, dt.toISOString());
            }}
          >
            Complete &amp; save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-[12.5px] text-[var(--ink-2)]">
          Reminder marked as completed. When should we remind {customer.name.split(' ')[0]} again?
        </div>
        <Field label="New next due date">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        {customer.phone && customer.medicines.length > 0 && (
          <div className="text-[11.5px] text-[var(--muted)] px-3 py-2 rounded-md bg-[var(--bg-soft)] border border-[var(--border)]">
            After saving, you can tap WhatsApp or SMS to send a thank-you message.
          </div>
        )}
      </div>
    </Modal>
  );
}

function ThankYouModal({
  data,
  onClose,
}: {
  data: { customer: Customer; links: ReminderLinks } | null;
  onClose: () => void;
}) {
  if (!data) return null;
  const { customer, links } = data;
  return (
    <Modal
      open={!!data}
      onClose={onClose}
      title="Send thank-you"
      subtitle={`Optional follow-up to ${customer.name}`}
      size="md"
      footer={<Button variant="secondary" onClick={onClose}>Skip</Button>}
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-md bg-[var(--bg-soft)] border border-[var(--border)] p-3 text-[12.5px] text-[var(--ink-2)] leading-relaxed">
          {links.message}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={links.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="inline-flex items-center gap-1 h-9 px-4 rounded-md text-[13px] font-medium text-white bg-[#25D366] hover:bg-[#1ebd5a] transition-colors"
          >
            <MessageCircle size={14} strokeWidth={1.9} /> WhatsApp
          </a>
          <a
            href={links.smsUrl}
            onClick={onClose}
            className="inline-flex items-center gap-1 h-9 px-4 rounded-md text-[13px] font-medium text-white bg-[var(--brand-700)] hover:bg-[var(--brand-800)] transition-colors"
          >
            <MessageSquare size={14} strokeWidth={1.9} /> SMS
          </a>
        </div>
      </div>
    </Modal>
  );
}
