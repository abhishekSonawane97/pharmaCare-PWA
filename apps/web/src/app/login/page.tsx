'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Logomark, Wordmark } from '@/components/Logomark';
import { Button } from '@/components/Button';
import { Input, Field } from '@/components/Input';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { TENANTS, TenantId, getLastTenant } from '@/lib/tenants';

export default function LoginPage() {
  const { login, signup } = useAuth();
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [showPw, setShowPw] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  // Tenant selection — restored from localStorage on mount (avoids SSR hydration mismatch via lazy init)
  const [tenant, setTenant] = useState<TenantId>(TENANTS[0].id);
  useEffect(() => { setTenant(getLastTenant()); }, []);

  // sign-in fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // sign-up fields
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPhone, setSuPhone] = useState('');
  const [suPassword, setSuPassword] = useState('');

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password, tenant);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Sign-in failed';
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await signup({ name: suName, email: suEmail, phone: suPhone, password: suPassword, tenant });
      if (result.pending) {
        setPendingNotice(`Account created — your access is awaiting admin approval.`);
        setSuName(''); setSuEmail(''); setSuPhone(''); setSuPassword('');
        setTab('in');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-up failed');
    } finally {
      setPending(false);
    }
  }

  const tenantField = (
    <Field label="Pharmacy" required>
      <select
        value={tenant}
        onChange={e => setTenant(e.target.value as TenantId)}
        className="appearance-none w-full h-9 px-3 rounded-md border border-[var(--border)] bg-white text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-500)_22%,transparent)]"
      >
        {TENANTS.map(t => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
    </Field>
  );

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      <div
        className="hidden md:flex flex-1 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, var(--brand-800), var(--brand-700) 40%, var(--brand-600))' }}
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '20px 20px' }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2">
            <Logomark size={32} />
            <span className="font-semibold text-[18px] tracking-tight">PharmaCare</span>
          </div>
          <div className="max-w-md">
            <div className="text-[11px] uppercase tracking-[0.18em] opacity-70 mb-3">Pharmacy management, simplified</div>
            <h1 className="text-[34px] leading-[1.1] font-semibold tracking-tight">
              Run your counter, ledger, and refill reminders from one calm dashboard.
            </h1>
            <p className="text-[14px] opacity-80 mt-4 leading-relaxed">
              Track medicines, customers, payments and one-tap WhatsApp/SMS refills — built for independent pharmacies.
            </p>
          </div>
          <div className="text-[12px] opacity-60">v1.0 · Internal tool</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="md:hidden flex justify-center mb-8"><Wordmark size={32} /></div>

          <div className="flex items-center gap-1 bg-[var(--bg-soft)] border border-[var(--border)] p-1 rounded-md mb-6">
            <button
              onClick={() => { setTab('in'); setError(null); }}
              className={`flex-1 h-8 rounded text-[12.5px] font-medium transition-colors ${tab === 'in' ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)]'}`}
            >Sign in</button>
            <button
              onClick={() => { setTab('up'); setError(null); }}
              className={`flex-1 h-8 rounded text-[12.5px] font-medium transition-colors ${tab === 'up' ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)]'}`}
            >Sign up</button>
          </div>

          {pendingNotice && (
            <div className="mb-4 px-3 py-2.5 rounded-md border border-[color-mix(in_oklab,var(--success)_28%,transparent)] bg-[color-mix(in_oklab,var(--success)_10%,transparent)] text-[12.5px] text-[var(--success-ink)]">
              {pendingNotice}
            </div>
          )}

          {tab === 'in' ? (
            <>
              <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-2">Sign in</div>
              <h2 className="text-[24px] font-semibold tracking-tight text-[var(--ink)]">Welcome back</h2>
              <p className="text-[13px] text-[var(--muted)] mt-1.5 mb-7">Choose your pharmacy, then enter your credentials.</p>
              <form onSubmit={onSignIn} className="flex flex-col gap-4">
                {tenantField}
                <Field label="Email" required>
                  <Input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@pharmacare.local" />
                </Field>
                <Field label="Password" required>
                  <div className="relative">
                    <Input type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      {showPw ? <EyeOff size={14} strokeWidth={1.8} /> : <Eye size={14} strokeWidth={1.8} />}
                    </button>
                  </div>
                </Field>
                {error && <div className="text-[12px] text-[var(--danger)]">{error}</div>}
                <Button size="lg" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</Button>
                <div className="text-center text-[12.5px] text-[var(--muted)]">
                  New employee?{' '}
                  <button type="button" onClick={() => { setTab('up'); setError(null); }} className="text-[var(--brand-700)] hover:underline">Request access</button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-2">Sign up</div>
              <h2 className="text-[24px] font-semibold tracking-tight text-[var(--ink)]">Request access</h2>
              <p className="text-[13px] text-[var(--muted)] mt-1.5 mb-7">First user becomes admin. Subsequent signups need admin approval.</p>
              <form onSubmit={onSignUp} className="flex flex-col gap-4">
                {tenantField}
                <Field label="Full name" required>
                  <Input value={suName} onChange={e => setSuName(e.target.value)} placeholder="Aditi Sharma" />
                </Field>
                <Field label="Email" required>
                  <Input type="email" autoComplete="email" value={suEmail} onChange={e => setSuEmail(e.target.value)} placeholder="you@pharmacare.local" />
                </Field>
                <Field label="Phone" required>
                  <Input value={suPhone} onChange={e => setSuPhone(e.target.value)} placeholder="10 digits" />
                </Field>
                <Field label="Password" required>
                  <Input type="password" autoComplete="new-password" value={suPassword} onChange={e => setSuPassword(e.target.value)} placeholder="Min 6 characters" />
                </Field>
                {error && <div className="text-[12px] text-[var(--danger)]">{error}</div>}
                <Button size="lg" type="submit" disabled={pending}>{pending ? 'Submitting…' : 'Create account'}</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
