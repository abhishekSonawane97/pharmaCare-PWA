'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Phone, MapPin, Calendar, Edit, Bell, Plus, Trash2, ChevronLeft, Wallet, ArrowDown, ArrowUp } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button, IconButton } from '@/components/Button';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { Input, Field, Textarea } from '@/components/Input';
import { CustomerForm } from '@/components/CustomerForm';
import { fmtDate, fmtINR, dueLabel, toDateInputValue } from '@/lib/format';
import type { Customer, Payment, Medicine } from '@/lib/types';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueModalOpen, setDueModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmPay, setConfirmPay] = useState<Payment | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ customer: Customer; recentPayments: Payment[] }>(`/customers/${id}`);
      setCustomer(data.customer);
      setPayments(data.recentPayments);
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Failed to load', tone: 'danger' });
      if (err instanceof ApiError && err.status === 404) router.push('/customers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    api<{ medicines: Medicine[] }>('/medicines').then(d => setMedicines(d.medicines)).catch(() => {});
  }, []);

  if (loading || !customer) {
    return <div className="text-[13px] text-[var(--muted)]">Loading customer…</div>;
  }

  const totalRecv = payments.filter(p => p.type === 'received').reduce((s, p) => s + p.amount, 0);
  const totalGiven = payments.filter(p => p.type === 'given').reduce((s, p) => s + p.amount, 0);
  const due = dueLabel(customer.nextDueDate);

  async function saveEdit(data: any) {
    try {
      const res = await api<{ customer: Customer }>(`/customers/${customer!._id}`, { method: 'PUT', body: data });
      setCustomer(res.customer);
      toast({ message: 'Profile updated', tone: 'success' });
      setEditOpen(false);
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Save failed', tone: 'danger' });
    }
  }

  async function saveDueDate(date: string) {
    try {
      const iso = new Date(date).toISOString();
      const res = await api<{ customer: Customer }>(`/customers/${customer!._id}/due-date`, {
        method: 'PATCH',
        body: { nextDueDate: iso },
      });
      setCustomer(res.customer);
      toast({ message: 'Due date updated', tone: 'success' });
      setDueModalOpen(false);
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Save failed', tone: 'danger' });
    }
  }

  async function savePayment(data: { type: 'received' | 'given'; amount: number; date: string; notes?: string }) {
    try {
      await api('/payments', {
        method: 'POST',
        body: { ...data, customerId: customer!._id },
      });
      toast({ message: 'Payment recorded', tone: 'success' });
      setPayModalOpen(false);
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Save failed', tone: 'danger' });
    }
  }

  async function deletePayment(p: Payment) {
    try {
      await api(`/payments/${p._id}`, { method: 'DELETE' });
      toast({ message: 'Record deleted', tone: 'success' });
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Delete failed', tone: 'danger' });
    }
  }

  return (
    <div>
      <button
        onClick={() => router.push('/customers')}
        className="flex items-center gap-1 text-[12.5px] text-[var(--muted)] hover:text-[var(--ink)] mb-4"
      >
        <ChevronLeft size={13} strokeWidth={1.8} /> Back to customers
      </button>

      <PageHeader
        eyebrow="Customer profile"
        title={
          <span className="inline-flex items-center gap-2 flex-wrap">
            {customer.name}
            {customer.reminderIgnored && (
              <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-md text-[10.5px] uppercase tracking-[0.08em] font-medium bg-[var(--bg-soft)] text-[var(--muted)] border border-[var(--border)]">
                <Bell size={10} strokeWidth={1.8} /> Ignored from reminders
              </span>
            )}
          </span>
        }
        subtitle={customer.notes || 'No notes recorded'}
        actions={
          user?.role === 'admin' && (
            <>
              <Button variant="secondary" icon={Edit} onClick={() => setEditOpen(true)}>Edit profile</Button>
              <Button icon={Calendar} onClick={() => setDueModalOpen(true)}>Update due date</Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="bg-white border border-[var(--border)] rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mb-3">Contact</div>
          <ul className="flex flex-col gap-2.5 text-[13px]">
            <li className="flex items-center gap-2.5 text-[var(--ink-2)]">
              <Phone size={13} strokeWidth={1.8} className="text-[var(--muted)]" />
              <span className="tabular-nums">{customer.phone}</span>
            </li>
            {customer.altPhone && (
              <li className="flex items-center gap-2.5 text-[var(--ink-2)]">
                <Phone size={13} strokeWidth={1.8} className="text-[var(--muted)]" />
                <span className="tabular-nums">{customer.altPhone}</span>
                <span className="text-[11px] text-[var(--muted)]">alt</span>
              </li>
            )}
            {customer.address && (
              <li className="flex items-start gap-2.5 text-[var(--ink-2)]">
                <MapPin size={13} strokeWidth={1.8} className="text-[var(--muted)] mt-0.5" />
                <span>{customer.address}</span>
              </li>
            )}
          </ul>
        </div>

        <div className="bg-white border border-[var(--border)] rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mb-3">Next refill</div>
          <div className="flex items-baseline gap-3">
            <div className="text-[24px] font-semibold tracking-tight text-[var(--ink)]">{fmtDate(customer.nextDueDate)}</div>
            <Badge tone={due.tone} dot>{due.label}</Badge>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--border)] text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mb-2">Medicines</div>
          <div className="flex flex-wrap gap-1.5">
            {customer.medicines.map((m, i) => <Badge key={i} tone="brand">{m.medicineName}</Badge>)}
            {customer.medicines.length === 0 && <span className="text-[12px] text-[var(--muted)] italic">None on file</span>}
          </div>
        </div>

        <div className="bg-white border border-[var(--border)] rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mb-3">Ledger summary</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-[var(--muted)]">Received</div>
              <div className="text-[18px] font-semibold tabular-nums text-[var(--success-ink)]">{fmtINR(totalRecv)}</div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--muted)]">Given</div>
              <div className="text-[18px] font-semibold tabular-nums text-[var(--danger-ink)]">{fmtINR(totalGiven)}</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--border)] text-[11px] text-[var(--muted)]">
            {payments.length} record{payments.length === 1 ? '' : 's'} on file
          </div>
        </div>
      </div>

      <div className="bg-white border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
          <div>
            <div className="text-[14px] font-semibold text-[var(--ink)]">Payment records</div>
            <div className="text-[12px] text-[var(--muted)]">Manual ledger — offline transactions only</div>
          </div>
          {user?.role === 'admin' && (
            <Button icon={Plus} size="sm" onClick={() => setPayModalOpen(true)}>Add record</Button>
          )}
        </div>
        {payments.length === 0 ? (
          <EmptyState icon={Wallet} title="No payment records yet" body="Add a record when this customer pays in person." />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[560px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] bg-[var(--bg-soft)]">
                <th className="py-2.5 px-5 font-medium">Date</th>
                <th className="py-2.5 px-5 font-medium">Type</th>
                <th className="py-2.5 px-5 font-medium text-right">Amount</th>
                <th className="py-2.5 px-5 font-medium">Note</th>
                {user?.role === 'admin' && <th className="py-2.5 px-5 w-[60px]"></th>}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p._id} className="border-t border-[var(--border)] hover:bg-[var(--bg-soft)]/60 group">
                  <td className="py-3 px-5 text-[var(--ink-2)] tabular-nums">{fmtDate(p.date)}</td>
                  <td className="py-3 px-5">
                    <Badge tone={p.type === 'received' ? 'success' : 'danger'} dot>
                      {p.type === 'received' ? 'Received' : 'Given'}
                    </Badge>
                  </td>
                  <td
                    className={`py-3 px-5 text-right tabular-nums font-semibold ${
                      p.type === 'received' ? 'text-[var(--success-ink)]' : 'text-[var(--danger-ink)]'
                    }`}
                  >
                    {p.type === 'received' ? '+' : '−'}{fmtINR(p.amount)}
                  </td>
                  <td className="py-3 px-5 text-[var(--ink-2)] italic">
                    {p.notes || <span className="text-[var(--muted)] not-italic">—</span>}
                  </td>
                  {user?.role === 'admin' && (
                    <td className="py-3 px-5">
                      <div className="opacity-0 group-hover:opacity-100">
                        <IconButton icon={Trash2} tone="danger" onClick={() => setConfirmPay(p)} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <DueDateModal open={dueModalOpen} onClose={() => setDueModalOpen(false)} customer={customer} onSave={saveDueDate} />
      <PaymentModal open={payModalOpen} onClose={() => setPayModalOpen(false)} customerName={customer.name} onSave={savePayment} />
      <CustomerForm open={editOpen} onClose={() => setEditOpen(false)} existing={customer} medicines={medicines} onSave={saveEdit} />
      <ConfirmDialog
        open={!!confirmPay}
        onClose={() => setConfirmPay(null)}
        onConfirm={() => confirmPay && deletePayment(confirmPay)}
        title="Delete payment record?"
        message="This will permanently remove the record from the ledger."
        confirmLabel="Delete"
      />
    </div>
  );
}

function DueDateModal({
  open,
  onClose,
  customer,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSave: (date: string) => void;
}) {
  const [date, setDate] = useState('');
  useEffect(() => {
    if (open) setDate(toDateInputValue(customer?.nextDueDate));
  }, [open, customer]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update next due date"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!date} onClick={() => date && onSave(date)}>Save</Button>
        </>
      }
    >
      <Field label="Next due date" hint="When should we remind this customer next?">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[7, 15, 30, 45, 60, 90].map(n => {
          const d = new Date();
          d.setDate(d.getDate() + n);
          return (
            <button
              key={n}
              onClick={() => setDate(toDateInputValue(d))}
              className="px-2.5 h-7 rounded-md border border-[var(--border)] text-[12px] text-[var(--ink-2)] hover:bg-[var(--brand-50)] hover:border-[var(--brand-300)] hover:text-[var(--brand-800)]"
            >
              +{n} days
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function PaymentModal({
  open,
  onClose,
  customerName,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  customerName?: string;
  onSave: (data: { type: 'received' | 'given'; amount: number; date: string; notes?: string }) => void;
}) {
  const [form, setForm] = useState({ amount: '', type: 'received' as 'received' | 'given', notes: '', date: '' });

  useEffect(() => {
    if (open) setForm({ amount: '', type: 'received', notes: '', date: toDateInputValue(new Date()) });
  }, [open]);

  function submit() {
    if (!form.amount) return;
    const dt = new Date(form.date);
    onSave({
      type: form.type,
      amount: Number(form.amount),
      date: isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString(),
      notes: form.notes || undefined,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add payment record"
      subtitle={customerName ? `For ${customerName}` : null}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save record</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Type" required>
          <div className="flex gap-2">
            {[
              { v: 'received' as const, l: 'Received', icon: ArrowDown },
              { v: 'given' as const, l: 'Given', icon: ArrowUp },
            ].map(o => {
              const Icon = o.icon;
              const active = form.type === o.v;
              const cls = active
                ? o.v === 'received'
                  ? 'border-[var(--success)] bg-[color-mix(in_oklab,var(--success)_10%,transparent)] text-[var(--success-ink)]'
                  : 'border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] text-[var(--danger-ink)]'
                : 'border-[var(--border)] text-[var(--ink-2)] hover:bg-[var(--bg-soft)]';
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setForm({ ...form, type: o.v })}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-md border text-[13px] transition-colors ${cls}`}
                >
                  <Icon size={14} strokeWidth={1.8} />
                  {o.l}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Amount (₹)" required>
          <Input
            type="number"
            step="1"
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            placeholder="0"
          />
        </Field>
        <Field label="Date">
          <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Note" hint="Optional">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="e.g. paid for Feb medicines"
          />
        </Field>
      </div>
    </Modal>
  );
}
