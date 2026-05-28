// pages.jsx — page-level views for PharmaCare
const { useState: uS, useEffect: uE, useMemo: uM, useCallback: uC, useRef: uR } = React;

// ────────────────────────────────────────────────────────────────────────────
// LOGIN
// ────────────────────────────────────────────────────────────────────────────
const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = uS('aditi@pharmacare.local');
  const [password, setPassword] = uS('••••••••');
  const [showPw, setShowPw] = uS(false);
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      <div className="hidden md:flex flex-1 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, var(--brand-800), var(--brand-700) 40%, var(--brand-600))' }}>
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '20px 20px' }}/>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2">
            <Logomark size={32}/>
            <span className="font-semibold text-[18px] tracking-tight">PharmaCare</span>
          </div>
          <div className="max-w-md">
            <div className="text-[11px] uppercase tracking-[0.18em] opacity-70 mb-3">Pharmacy management, simplified</div>
            <h1 className="text-[34px] leading-[1.1] font-semibold tracking-tight">Run your counter, ledger, and refill reminders from one calm dashboard.</h1>
            <p className="text-[14px] opacity-80 mt-4 leading-relaxed">Track medicines, customers, payments and automated WhatsApp refills — built for independent pharmacies.</p>
          </div>
          <div className="text-[12px] opacity-60">v1.0 · Internal tool</div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="md:hidden flex justify-center mb-8"><Wordmark size={32}/></div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-2">Sign in</div>
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--ink)]">Welcome back</h2>
          <p className="text-[13px] text-[var(--muted)] mt-1.5 mb-7">Use your registered email and password.</p>
          <form onSubmit={(e) => { e.preventDefault(); onLogin?.(); }} className="flex flex-col gap-4">
            <Field label="Email" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@pharmacare.local"/></Field>
            <Field label="Password" required>
              <div className="relative">
                <Input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}/>
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]">
                  <Icon name="eye" size={14}/>
                </button>
              </div>
            </Field>
            <div className="flex items-center justify-between text-[12.5px]">
              <label className="flex items-center gap-2 text-[var(--ink-2)]"><input type="checkbox" className="accent-[var(--brand-700)]"/> Remember me</label>
              <a className="text-[var(--brand-700)] hover:underline cursor-pointer">Forgot password?</a>
            </div>
            <Button size="lg" type="submit">Sign in</Button>
            <div className="text-center text-[12.5px] text-[var(--muted)]">New employee? <a className="text-[var(--brand-700)] hover:underline cursor-pointer">Request access</a></div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ────────────────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon, tone = 'neutral', trend }) => {
  const tones = {
    neutral: { bg: 'bg-white', ic: 'text-[var(--brand-700)] bg-[var(--brand-50)]' },
    warning: { bg: 'bg-white', ic: 'text-[var(--warning-ink)] bg-[color-mix(in_oklab,var(--warning)_14%,transparent)]' },
    danger:  { bg: 'bg-white', ic: 'text-[var(--danger-ink)] bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]' },
    success: { bg: 'bg-white', ic: 'text-[var(--success-ink)] bg-[color-mix(in_oklab,var(--success)_14%,transparent)]' },
  }[tone];
  return (
    <div className={`${tones.bg} border border-[var(--border)] rounded-lg p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] font-medium">{label}</div>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${tones.ic}`}><Icon name={icon} size={14}/></div>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-[28px] font-semibold tracking-tight text-[var(--ink)] tabular-nums">{value}</div>
        {trend && <div className="text-[11.5px] text-[var(--muted)]">{trend}</div>}
      </div>
      {sub && <div className="text-[12px] text-[var(--muted)]">{sub}</div>}
    </div>
  );
};

const Dashboard = ({ data, role, navigate }) => {
  const dueToday   = data.customers.filter(c => daysFromToday(c.nextDueDate) === 0 && c.isActive).length;
  const due2Days   = data.customers.filter(c => { const d = daysFromToday(c.nextDueDate); return d !== null && d >= 0 && d <= 2 && c.isActive; }).length;
  const pending    = data.employees.filter(e => !e.isApproved).length;
  const recentReminders = data.customers.filter(c => { const d = daysFromToday(c.nextDueDate); return d !== null && d >= 0 && d <= 2 && c.isActive; }).slice(0, 5);
  const recentPayments = [...data.payments].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const totalReceived = data.payments.filter(p => p.type === 'received').reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <PageHeader
        eyebrow={`Today · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}`}
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${role === 'admin' ? 'Aditi' : 'Rohan'}`}
        subtitle="Here's what needs your attention today."
        actions={role === 'admin' && <>
          <Button variant="secondary" icon="download">Export</Button>
          <Button icon="plus" onClick={() => navigate('customers')}>Add customer</Button>
        </>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Medicines" value={data.medicines.length} sub={`${data.medicines.filter(m => m.addedFrom === 'bill').length} added from bill`} icon="pill"/>
        <StatCard label="Active Customers" value={data.customers.filter(c => c.isActive).length} sub={`${data.customers.length} total in system`} icon="users"/>
        <StatCard label="Due Today" value={dueToday} sub={`${due2Days} due within 2 days`} icon="bell" tone={dueToday > 0 ? 'warning' : 'neutral'}/>
        {role === 'admin'
          ? <StatCard label="Pending Approvals" value={pending} sub={pending > 0 ? 'Action required' : 'All staff approved'} icon="user" tone={pending > 0 ? 'danger' : 'neutral'}/>
          : <StatCard label="Payments (30d)" value={fmtINR(totalReceived)} sub={`${data.payments.length} records`} icon="wallet" tone="success"/>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
            <div>
              <div className="text-[14px] font-semibold text-[var(--ink)]">Refills due soon</div>
              <div className="text-[12px] text-[var(--muted)]">Customers due within 2 days</div>
            </div>
            <button onClick={() => navigate('reminders')} className="text-[12.5px] text-[var(--brand-700)] hover:underline flex items-center gap-1">View all <Icon name="chevR" size={12}/></button>
          </div>
          {recentReminders.length === 0 ? (
            <EmptyState icon="bell" title="Nothing due in the next 2 days" body="Reminders will surface here automatically."/>
          ) : (
            <ul>
              {recentReminders.map((c, i) => {
                const d = daysFromToday(c.nextDueDate);
                return (
                  <li key={c.id} className={`flex items-center gap-3 px-5 py-3 ${i < recentReminders.length - 1 ? 'border-b border-[var(--border)]' : ''}`}>
                    <div className="w-9 h-9 rounded-full bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center text-[12.5px] font-medium">{c.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[var(--ink)] truncate">{c.name}</div>
                      <div className="text-[12px] text-[var(--muted)] truncate">{c.medicines.map(m => m.medicineName).join(', ')}</div>
                    </div>
                    <Badge tone={d === 0 ? 'danger' : d === 1 ? 'warning' : 'brand'} dot>{d === 0 ? 'Due today' : d === 1 ? 'Tomorrow' : `In ${d} days`}</Badge>
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
            <button onClick={() => navigate('payments')} className="text-[12.5px] text-[var(--brand-700)] hover:underline flex items-center gap-1">All <Icon name="chevR" size={12}/></button>
          </div>
          <ul>
            {recentPayments.map((p, i) => {
              const cust = data.customers.find(c => c.id === p.customerId);
              return (
                <li key={p.id} className={`flex items-center gap-3 px-5 py-3 ${i < recentPayments.length - 1 ? 'border-b border-[var(--border)]' : ''}`}>
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center ${p.type === 'received' ? 'bg-[color-mix(in_oklab,var(--success)_12%,transparent)] text-[var(--success-ink)]' : 'bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] text-[var(--danger-ink)]'}`}>
                    <Icon name={p.type === 'received' ? 'arrowDown' : 'arrowUp'} size={12}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">{cust?.name || '—'}</div>
                    <div className="text-[11.5px] text-[var(--muted)]">{fmtDateShort(p.date)}</div>
                  </div>
                  <div className={`text-[13px] font-semibold tabular-nums ${p.type === 'received' ? 'text-[var(--success-ink)]' : 'text-[var(--danger-ink)]'}`}>
                    {p.type === 'received' ? '+' : '−'}{fmtINR(p.amount)}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// MEDICINES
// ────────────────────────────────────────────────────────────────────────────
const MedicineList = ({ data, setData, role }) => {
  const toast = useToast();
  const [q, setQ] = uS('');
  const [typeFilter, setTypeFilter] = uS('all');
  const [editing, setEditing] = uS(null);
  const [adding, setAdding] = uS(null); // 'manual' | 'bill' | null
  const [confirm, setConfirm] = uS(null);

  const filtered = uM(() => {
    let list = data.medicines;
    if (typeFilter !== 'all') list = list.filter(m => m.type === typeFilter);
    if (q.trim()) {
      const ql = q.toLowerCase();
      list = list.filter(m => (m.name || '').toLowerCase().includes(ql) || (m.content || '').toLowerCase().includes(ql));
    }
    return list;
  }, [q, typeFilter, data.medicines]);

  const TYPE_LABEL = { tab: 'Tablet', cap: 'Capsule', syrup: 'Syrup' };

  const save = (m) => {
    if (m.id) {
      setData(d => ({ ...d, medicines: d.medicines.map(x => x.id === m.id ? m : x) }));
      toast({ message: `Updated ${m.name}`, tone: 'success' });
    } else {
      const dupe = data.medicines.find(x => x.name.toLowerCase() === m.name.toLowerCase());
      if (dupe) { toast({ message: 'A medicine with that name already exists', tone: 'danger' }); return false; }
      setData(d => ({ ...d, medicines: [{ ...m, id: 'm' + Date.now() }, ...d.medicines] }));
      toast({ message: `Added ${m.name}`, tone: 'success' });
    }
    return true;
  };

  return (
    <div>
      <PageHeader title="Medicines" subtitle={`${data.medicines.length} items in your catalog`}
        actions={role === 'admin' && <>
          <Button variant="secondary" icon="flask" onClick={() => setAdding('bill')}>Add from bill</Button>
          <Button icon="plus" onClick={() => setAdding('manual')}>Add medicine</Button>
        </>}/>

      <div className="bg-white border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-[130px]">
            <option value="all">All types</option>
            <option value="tab">Tablet</option>
            <option value="cap">Capsule</option>
            <option value="syrup">Syrup</option>
          </Select>
          <div className="flex-1 max-w-md"><Input icon="search" placeholder="Search by name or content…" value={q} onChange={(e) => setQ(e.target.value)}/></div>
          <div className="ml-auto text-[12px] text-[var(--muted)]">{filtered.length} of {data.medicines.length}</div>
        </div>

        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] bg-[var(--bg-soft)]">
              <th className="py-2.5 px-4 font-medium">Name</th>
              <th className="py-2.5 px-4 font-medium">Content / Generic</th>
              <th className="py-2.5 px-4 font-medium text-right">Purchase</th>
              <th className="py-2.5 px-4 font-medium text-right">MRP</th>
              <th className="py-2.5 px-4 font-medium text-right">Margin</th>
              <th className="py-2.5 px-4 font-medium">Type</th>
              {role === 'admin' && <th className="py-2.5 px-4 font-medium w-[80px]"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const margin = ((m.mrp - m.purchasePrice) / m.mrp * 100).toFixed(0);
              return (
                <tr key={m.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-soft)]/60 group">
                  <td className="py-3 px-4 font-medium text-[var(--ink)]">{m.name}</td>
                  <td className="py-3 px-4 text-[var(--ink-2)]">{m.content || <span className="text-[var(--muted)] italic">— not set</span>}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-[var(--ink-2)]">{fmtINR(m.purchasePrice)}</td>
                  <td className="py-3 px-4 text-right tabular-nums font-medium text-[var(--ink)]">{fmtINR(m.mrp)}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-[var(--success-ink)]">{margin}%</td>
                  <td className="py-3 px-4"><Badge tone={m.type === 'syrup' ? 'warning' : m.type === 'cap' ? 'brand' : 'neutral'}>{TYPE_LABEL[m.type] || '—'}</Badge></td>
                  {role === 'admin' && (
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconButton icon="edit" tone="brand" onClick={() => setEditing(m)}/>
                        <IconButton icon="trash" tone="danger" onClick={() => setConfirm(m)}/>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState icon="pill" title="No medicines match" body="Try a different search term."/>}
      </div>

      <MedicineForm open={!!editing || !!adding} onClose={() => { setEditing(null); setAdding(null); }}
        existing={editing} mode={adding} existingNames={data.medicines.map(x => x.name)}
        onSave={(m) => { const ok = save(m); if (ok) { setEditing(null); setAdding(null); } }}/>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        title={`Delete ${confirm?.name}?`}
        message="This medicine will be removed from your catalog. Customer prescriptions referencing it by name will keep their text but lose the link."
        confirmLabel="Delete"
        onConfirm={() => { setData(d => ({ ...d, medicines: d.medicines.filter(x => x.id !== confirm.id) })); toast({ message: 'Medicine deleted', tone: 'success' }); }}/>
    </div>
  );
};

const MedicineForm = ({ open, onClose, existing, mode, existingNames, onSave }) => {
  const [form, setForm] = uS({ name: '', content: '', purchasePrice: '', mrp: '', type: 'tab', addedFrom: 'manual' });
  const [errors, setErrors] = uS({});
  uE(() => {
    if (open) {
      setForm(existing || { name: '', content: '', purchasePrice: '', mrp: '', type: 'tab', addedFrom: mode === 'bill' ? 'bill' : 'manual' });
      setErrors({});
    }
  }, [open, existing, mode]);
  const dupe = form.name && existingNames.some(n => n.toLowerCase() === form.name.toLowerCase() && n !== existing?.name);
  const submit = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (dupe) e.name = 'A medicine with this name already exists';
    if (!form.purchasePrice) e.purchasePrice = 'Required';
    if (!form.mrp) e.mrp = 'Required';
    if (form.purchasePrice && form.mrp && Number(form.mrp) < Number(form.purchasePrice)) e.mrp = 'MRP cannot be less than purchase price';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({ ...form, purchasePrice: Number(form.purchasePrice), mrp: Number(form.mrp) });
  };
  const title = existing ? 'Edit medicine' : mode === 'bill' ? 'Add from bill' : 'Add medicine';
  const subtitle = mode === 'bill' && !existing ? 'Quickly add a medicine from a supplier bill — content can be filled in later.' : null;
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit}>{existing ? 'Save changes' : 'Add medicine'}</Button>
      </>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Brand name" required error={errors.name} hint={dupe ? null : 'e.g. Paracetamol 500mg'}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name}/>
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Content / Generic" hint={mode === 'bill' && !existing ? 'Optional — can fill in later' : 'Active ingredient(s)'}>
            <Input value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}/>
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Type" required>
            <div className="flex gap-2">
              {[{v:'tab',l:'Tablet'},{v:'cap',l:'Capsule'},{v:'syrup',l:'Syrup'}].map(o => (
                <button key={o.v} type="button" onClick={() => setForm({ ...form, type: o.v })}
                  className={`flex-1 h-9 rounded-md border text-[13px] transition-colors ${form.type === o.v ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-800)]' : 'border-[var(--border)] text-[var(--ink-2)] hover:bg-[var(--bg-soft)]'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <Field label="Purchase Price (₹)" required error={errors.purchasePrice}>
          <Input type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} error={errors.purchasePrice}/>
        </Field>
        <Field label="MRP (₹)" required error={errors.mrp}>
          <Input type="number" step="0.01" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} error={errors.mrp}/>
        </Field>
        {form.purchasePrice && form.mrp && Number(form.mrp) >= Number(form.purchasePrice) && (
          <div className="col-span-2 px-3 py-2 rounded-md bg-[var(--brand-50)] border border-[var(--brand-100)] text-[12px] text-[var(--brand-800)]">
            Margin: <b>{(((form.mrp - form.purchasePrice) / form.mrp) * 100).toFixed(0)}%</b> · Profit per unit: <b>{fmtINR(form.mrp - form.purchasePrice)}</b>
          </div>
        )}
      </div>
    </Modal>
  );
};

Object.assign(window, { LoginPage, Dashboard, MedicineList, StatCard });
