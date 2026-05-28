'use client';

import { useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { Input, Field } from '@/components/Input';
import { fmtDateShort } from '@/lib/format';
import type { User } from '@/lib/types';

export default function EmployeesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [active, setActive] = useState<User[]>([]);
  const [pending, setPending] = useState<User[]>([]);
  const [tab, setTab] = useState<'all' | 'pending'>('all');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<User | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<{ active: User[]; pending: User[] }>('/employees');
      setActive(data.active);
      setPending(data.pending);
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Failed to load', tone: 'danger' });
    }
  }

  useEffect(() => { load(); }, []);

  if (user?.role !== 'admin') {
    return <EmptyState icon={Users} title="Admin only" body="You don't have access to this page." />;
  }

  const list = tab === 'pending' ? pending : [...pending, ...active];

  async function approve(u: User) {
    setActioning(u._id);
    try {
      await api(`/employees/${u._id}/approve`, { method: 'POST' });
      toast({ message: `${u.name} approved`, tone: 'success' });
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Action failed', tone: 'danger' });
    } finally {
      setActioning(null);
    }
  }

  async function reject(u: User) {
    setActioning(u._id);
    try {
      await api(`/employees/${u._id}/reject`, { method: 'POST' });
      toast({ message: `Request rejected`, tone: 'success' });
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Action failed', tone: 'danger' });
    } finally {
      setActioning(null);
    }
  }

  async function remove(u: User) {
    try {
      await api(`/employees/${u._id}`, { method: 'DELETE' });
      toast({ message: 'Employee removed', tone: 'success' });
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Remove failed', tone: 'danger' });
    }
  }

  async function addEmployee(form: { name: string; email: string; phone: string; password: string; role: 'admin' | 'employee' }) {
    try {
      await api('/employees', { method: 'POST', body: form });
      toast({ message: `${form.name} added`, tone: 'success' });
      setAdding(false);
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Add failed', tone: 'danger' });
    }
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage staff access and approvals"
        actions={<Button icon={Plus} onClick={() => setAdding(true)}>Add employee</Button>}
      />

      <div className="flex items-center gap-1 bg-[var(--bg-soft)] border border-[var(--border)] p-1 rounded-md w-fit mb-4">
        {[
          { v: 'all' as const, l: 'All employees', n: pending.length + active.length },
          { v: 'pending' as const, l: 'Pending approval', n: pending.length, badge: pending.length > 0 },
        ].map(t => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`flex items-center gap-2 px-3 h-8 rounded text-[12.5px] font-medium transition-colors ${
              tab === t.v ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {t.l}{' '}
            <span
              className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] flex items-center justify-center ${
                t.badge ? 'bg-[var(--danger)] text-white' : 'bg-[var(--bg)] text-[var(--muted)]'
              }`}
            >
              {t.n}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[760px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] bg-[var(--bg-soft)]">
              <th className="py-2.5 px-4 font-medium">Name</th>
              <th className="py-2.5 px-4 font-medium">Email</th>
              <th className="py-2.5 px-4 font-medium">Phone</th>
              <th className="py-2.5 px-4 font-medium">Role</th>
              <th className="py-2.5 px-4 font-medium">Status</th>
              <th className="py-2.5 px-4 font-medium">Joined</th>
              <th className="py-2.5 px-4 font-medium w-[200px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(u => (
              <tr key={u._id} className="border-t border-[var(--border)] hover:bg-[var(--bg-soft)]/60">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size={28} />
                    <div className="font-medium text-[var(--ink)]">{u.name}</div>
                  </div>
                </td>
                <td className="py-3 px-4 text-[var(--ink-2)]">{u.email}</td>
                <td className="py-3 px-4 text-[var(--ink-2)] tabular-nums">{u.phone}</td>
                <td className="py-3 px-4">
                  <Badge tone={u.role === 'admin' ? 'brand' : 'neutral'}>
                    {u.role === 'admin' ? 'Admin' : 'Employee'}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <Badge tone={u.status === 'active' ? 'success' : 'warning'} dot>
                    {u.status === 'active' ? 'Active' : 'Pending'}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-[var(--ink-2)] tabular-nums">{fmtDateShort(u.createdAt)}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1.5">
                    {u.status === 'pending' && (
                      <>
                        <Button size="sm" variant="success" disabled={actioning === u._id} onClick={() => approve(u)}>Approve</Button>
                        <Button size="sm" variant="secondary" disabled={actioning === u._id} onClick={() => reject(u)}>Reject</Button>
                      </>
                    )}
                    {u.status === 'active' && u.role !== 'admin' && (
                      <Button size="sm" variant="secondary" onClick={() => setRemoving(u)}>Remove</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {list.length === 0 && (
          <EmptyState
            icon={Users}
            title={tab === 'pending' ? 'No pending approvals' : 'No employees'}
            body={tab === 'pending' ? 'All staff accounts are approved.' : ''}
          />
        )}
      </div>

      <AddEmployeeModal open={adding} onClose={() => setAdding(false)} onSave={addEmployee} />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
        title={`Remove ${removing?.name}?`}
        message="Their access will be revoked immediately. This action cannot be undone."
        confirmLabel="Remove access"
      />
    </div>
  );
}

function AddEmployeeModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: { name: string; email: string; phone: string; password: string; role: 'admin' | 'employee' }) => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'employee' as 'admin' | 'employee' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', phone: '', password: '', role: 'employee' });
      setErrors({});
    }
  }, [open]);

  function submit() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    if (!form.phone.trim()) e.phone = 'Required';
    if (!form.password || form.password.length < 6) e.password = 'Min 6 characters';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave(form);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add employee"
      subtitle="Creates a pre-approved staff account."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Add employee</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Full name" required error={errors.name}>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email" required error={errors.email}>
          <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Phone" required error={errors.phone}>
          <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Initial password" required error={errors.password}>
          <Input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
        </Field>
        <div className="col-span-2">
          <Field label="Role" required>
            <div className="flex gap-2">
              {(['employee', 'admin'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm({ ...form, role: v })}
                  className={`flex-1 h-9 rounded-md border text-[13px] capitalize transition-colors ${
                    form.role === v
                      ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-800)]'
                      : 'border-[var(--border)] text-[var(--ink-2)] hover:bg-[var(--bg-soft)]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
