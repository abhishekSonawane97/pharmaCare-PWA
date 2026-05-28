'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Edit, Trash2, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import { Input, Select } from '@/components/Input';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button, IconButton } from '@/components/Button';
import { ConfirmDialog } from '@/components/Modal';
import { CustomerForm } from '@/components/CustomerForm';
import { fmtDateShort, dueLabel } from '@/lib/format';
import type { Customer, Medicine } from '@/lib/types';

export default function CustomersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'due_this_week' | 'overdue'>('all');
  const [sort, setSort] = useState<'due_date' | 'name'>('due_date');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [removing, setRemoving] = useState<Customer | null>(null);
  const [total, setTotal] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ customers: Customer[]; total: number }>('/customers', {
        query: { q, filter, sort, limit: 200 },
      });
      setCustomers(data.customers);
      setTotal(data.total);
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Failed to load', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter, sort]);

  useEffect(() => {
    api<{ medicines: Medicine[] }>('/medicines').then(d => setMedicines(d.medicines)).catch(() => {});
  }, []);

  async function handleSave(data: any) {
    try {
      if (editing) {
        await api(`/customers/${editing._id}`, { method: 'PUT', body: data });
        toast({ message: `Updated ${data.name}`, tone: 'success' });
      } else {
        await api('/customers', { method: 'POST', body: data });
        toast({ message: `Added ${data.name}`, tone: 'success' });
      }
      setAdding(false); setEditing(null);
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Save failed', tone: 'danger' });
    }
  }

  async function handleRemove(c: Customer) {
    try {
      await api(`/customers/${c._id}`, { method: 'DELETE' });
      toast({ message: 'Customer removed', tone: 'success' });
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Remove failed', tone: 'danger' });
    }
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={loading ? 'Loading…' : `${customers.length} active customers`}
        actions={
          user?.role === 'admin' && (
            <Button icon={Plus} onClick={() => setAdding(true)}>Add customer</Button>
          )
        }
      />

      <div className="bg-white border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-[var(--border)] md:flex-row md:items-center">
          <div className="flex-1 md:max-w-md">
            <Input icon={Search} placeholder="Search by name or phone…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-1 bg-[var(--bg-soft)] border border-[var(--border)] p-1 rounded-md self-start overflow-x-auto">
            {[
              { v: 'all', l: 'All' },
              { v: 'due_this_week', l: 'Due this week' },
              { v: 'overdue', l: 'Overdue' },
            ].map(t => (
              <button
                key={t.v}
                onClick={() => setFilter(t.v as any)}
                className={`px-2.5 h-7 rounded text-[12px] font-medium transition-colors whitespace-nowrap ${
                  filter === t.v ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>
          <Select value={sort} onChange={e => setSort(e.target.value as any)} className="w-full md:w-[160px]">
            <option value="due_date">Sort: Due date</option>
            <option value="name">Sort: Name</option>
          </Select>
          <div className="md:ml-auto text-[12px] text-[var(--muted)]">
            {customers.length} of {total}
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-[13px] min-w-[640px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] bg-[var(--bg-soft)]">
              <th className="py-2.5 px-4 font-medium">Customer</th>
              <th className="py-2.5 px-4 font-medium">Phone</th>
              <th className="py-2.5 px-4 font-medium">Medicines</th>
              <th className="py-2.5 px-4 font-medium">Next due</th>
              <th className="py-2.5 px-4 font-medium">Status</th>
              {user?.role === 'admin' && <th className="py-2.5 px-4 w-[80px]"></th>}
            </tr>
          </thead>
          <tbody>
            {customers.map(c => {
              const { label, tone } = dueLabel(c.nextDueDate);
              return (
                <tr
                  key={c._id}
                  className="border-t border-[var(--border)] hover:bg-[var(--bg-soft)]/60 group cursor-pointer"
                  onClick={() => router.push(`/customers/${c._id}`)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} size={32} />
                      <div>
                        <div className="font-medium text-[var(--ink)] flex items-center gap-1.5">
                          {c.name}
                          {c.reminderIgnored && (
                            <span className="inline-flex items-center h-[18px] px-1.5 rounded text-[10px] uppercase tracking-[0.06em] font-medium bg-[var(--bg-soft)] text-[var(--muted)] border border-[var(--border)]">
                              Ignored
                            </span>
                          )}
                        </div>
                        {c.notes && (
                          <div className="text-[11.5px] text-[var(--muted)] truncate max-w-[220px]">{c.notes}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[var(--ink-2)] tabular-nums">{c.phone}</td>
                  <td className="py-3 px-4 text-[var(--ink-2)]">
                    <div className="max-w-[260px] truncate">{c.medicines.map(m => m.medicineName).join(', ')}</div>
                  </td>
                  <td className="py-3 px-4 text-[var(--ink-2)] tabular-nums">{fmtDateShort(c.nextDueDate)}</td>
                  <td className="py-3 px-4"><Badge tone={tone} dot>{label}</Badge></td>
                  {user?.role === 'admin' && (
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconButton icon={Edit} tone="brand" onClick={() => setEditing(c)} />
                        <IconButton icon={Trash2} tone="danger" onClick={() => setRemoving(c)} />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        <ul className="md:hidden divide-y divide-[var(--border)]">
          {customers.map(c => {
            const { label, tone } = dueLabel(c.nextDueDate);
            return (
              <li
                key={c._id}
                className="px-4 py-3 active:bg-[var(--bg-soft)]/60 cursor-pointer"
                onClick={() => router.push(`/customers/${c._id}`)}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={c.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-[14px] text-[var(--ink)] flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{c.name}</span>
                          {c.reminderIgnored && (
                            <span className="inline-flex items-center h-[18px] px-1.5 rounded text-[10px] uppercase tracking-[0.06em] font-medium bg-[var(--bg-soft)] text-[var(--muted)] border border-[var(--border)]">
                              Ignored
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-[var(--muted)] tabular-nums mt-0.5">{c.phone}</div>
                      </div>
                      <Badge tone={tone} dot>{label}</Badge>
                    </div>

                    <div className="mt-2">
                      <div className="text-[10px] uppercase tracking-[0.1em] font-medium text-[var(--muted)] mb-1">Medicines</div>
                      <div className="flex flex-wrap gap-1.5">
                        {c.medicines.length === 0 ? (
                          <span className="text-[12px] text-[var(--muted)] italic">— none</span>
                        ) : (
                          c.medicines.map((m, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center h-7 px-2.5 rounded-md bg-[var(--brand-50)] text-[var(--brand-800)] border border-[var(--brand-100)] text-[12.5px] font-medium"
                            >
                              {m.medicineName}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-[11.5px] text-[var(--muted)]">
                        Next due · <span className="text-[var(--ink-2)] tabular-nums">{fmtDateShort(c.nextDueDate)}</span>
                      </div>
                      {user?.role === 'admin' && (
                        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                          <IconButton icon={Edit} tone="brand" onClick={() => setEditing(c)} />
                          <IconButton icon={Trash2} tone="danger" onClick={() => setRemoving(c)} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {!loading && customers.length === 0 && (
          <EmptyState icon={Users} title="No customers found" body="Try a different search or add a new customer." />
        )}
      </div>

      <CustomerForm
        open={adding || !!editing}
        onClose={() => { setAdding(false); setEditing(null); }}
        existing={editing}
        medicines={medicines}
        onSave={handleSave}
      />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && handleRemove(removing)}
        title={`Remove ${removing?.name}?`}
        message="The customer will be soft-deleted. Their payment history is preserved but they'll no longer appear in lists or reminders."
        confirmLabel="Remove"
      />
    </div>
  );
}
