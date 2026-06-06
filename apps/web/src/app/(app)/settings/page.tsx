'use client';

import { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import { Input, Field, Textarea } from '@/components/Input';
import { Button } from '@/components/Button';
import type { Settings } from '@/lib/types';

export default function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await api<{ settings: Settings }>('/settings');
      setSettings(data.settings);
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Failed to load', tone: 'danger' });
    }
  }
  useEffect(() => { load(); }, []);

  if (user?.role !== 'admin') {
    return <EmptyState icon={SettingsIcon} title="Admin only" body="You don't have access to this page." />;
  }

  if (!settings) return <div className="text-[13px] text-[var(--muted)]">Loading settings…</div>;

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(s => (s ? { ...s, [key]: value } : s));
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const data = await api<{ settings: Settings }>('/settings', { method: 'PUT', body: settings });
      setSettings(data.settings);
      toast({ message: 'Settings saved', tone: 'success' });
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Save failed', tone: 'danger' });
    } finally {
      setSaving(false);
    }
  }

  const exampleReminder = settings.messageTemplateReminder
    .replace(/\{\{name\}\}/g, 'Ramesh Kulkarni')
    .replace(/\{\{pharmacyName\}\}/g, settings.pharmacyName || 'PharmaCare')
    .replace(/\{\{medicines\}\}/g, 'Metformin 500mg, Glimepiride 2mg')
    .replace(/\{\{dueDate\}\}/g, '12 May 2026');

  const exampleThanks = settings.messageTemplateThankYou
    .replace(/\{\{name\}\}/g, 'Ramesh Kulkarni')
    .replace(/\{\{pharmacyName\}\}/g, settings.pharmacyName || 'PharmaCare')
    .replace(/\{\{medicines\}\}/g, 'Metformin 500mg, Glimepiride 2mg')
    .replace(/\{\{nextDueDate\}\}/g, '12 Jun 2026');

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Pharmacy details and reminder message templates"
        actions={<Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[var(--border)] rounded-lg p-5 flex flex-col gap-4">
          <div className="text-[14px] font-semibold text-[var(--ink)]">Pharmacy</div>
          <Field label="Pharmacy name" required>
            <Input value={settings.pharmacyName} onChange={e => update('pharmacyName', e.target.value)} />
          </Field>
          <Field label="Address">
            <Textarea rows={2} value={settings.pharmacyAddress} onChange={e => update('pharmacyAddress', e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={settings.pharmacyPhone} onChange={e => update('pharmacyPhone', e.target.value)} />
          </Field>
          <Field label="Default refill cycle (days)">
            <Input
              type="number"
              value={String(settings.defaultRefillCycleDays)}
              onChange={e => update('defaultRefillCycleDays', Math.max(1, parseInt(e.target.value, 10) || 30))}
            />
          </Field>
        </div>

        <div className="bg-white border border-[var(--border)] rounded-lg p-5 flex flex-col gap-3">
          <div className="text-[14px] font-semibold text-[var(--ink)]">How sending works</div>
          <div className="text-[12.5px] text-[var(--ink-2)] leading-relaxed">
            Reminders are not auto-dispatched. On the Reminders page, each due customer
            shows a <b>WhatsApp</b> and an <b>SMS</b> button. Tapping either opens the
            native app on your phone with the customer&apos;s number and the message
            pre-filled — you tap Send in the app.
          </div>
          <div className="text-[12px] text-[var(--muted)] leading-relaxed">
            No API keys, no business account, no external service. Messages go from your
            own phone number / WhatsApp account.
          </div>
        </div>

        <div className="bg-white border border-[var(--border)] rounded-lg p-5 flex flex-col gap-4">
          <div>
            <div className="text-[14px] font-semibold text-[var(--ink)]">Reminder template</div>
            <div className="text-[12px] text-[var(--muted)]">
              Placeholders: <code>{'{{name}}'}</code> <code>{'{{pharmacyName}}'}</code> <code>{'{{medicines}}'}</code> <code>{'{{dueDate}}'}</code>
            </div>
          </div>
          <Textarea
            rows={4}
            value={settings.messageTemplateReminder}
            onChange={e => update('messageTemplateReminder', e.target.value)}
          />
          <div>
            <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mb-2">Preview</div>
            <div className="rounded-md border border-[var(--border)] p-3 bg-[var(--bg-soft)] text-[12.5px] text-[var(--ink-2)] leading-relaxed">
              {exampleReminder}
            </div>
          </div>
        </div>

        <div className="bg-white border border-[var(--border)] rounded-lg p-5 flex flex-col gap-4">
          <div>
            <div className="text-[14px] font-semibold text-[var(--ink)]">Thank-you template</div>
            <div className="text-[12px] text-[var(--muted)]">
              Placeholders: <code>{'{{name}}'}</code> <code>{'{{pharmacyName}}'}</code> <code>{'{{medicines}}'}</code> <code>{'{{nextDueDate}}'}</code>
            </div>
          </div>
          <Textarea
            rows={4}
            value={settings.messageTemplateThankYou}
            onChange={e => update('messageTemplateThankYou', e.target.value)}
          />
          <div>
            <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mb-2">Preview</div>
            <div className="rounded-md border border-[var(--border)] p-3 bg-[var(--bg-soft)] text-[12.5px] text-[var(--ink-2)] leading-relaxed">
              {exampleThanks}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
