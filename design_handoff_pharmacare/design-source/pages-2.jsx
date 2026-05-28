// pages-2.jsx — customers, reminders, payments, employees

const { useState: uuS, useEffect: uuE, useMemo: uuM } = React;

// ────────────────────────────────────────────────────────────────────────────
// CUSTOMERS LIST
// ────────────────────────────────────────────────────────────────────────────
const CustomerList = ({ data, setData, role, navigate }) => {
  const toast = useToast();
  const [q, setQ] = uuS('');
  const [editing, setEditing] = uuS(null);
  const [adding, setAdding] = uuS(false);
  const [confirm, setConfirm] = uuS(null);
  const [sort, setSort] = uuS('due');

  const filtered = uuM(() => {
    let list = data.customers.filter(c => c.isActive);
    if (q.trim()) {
      const ql = q.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(ql) || c.phone.includes(ql));
    }
    if (sort === 'due') list = [...list].sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));
    else if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [q, data.customers, sort]);

  const save = (c) => {
    if (c.id) {
      setData(d => ({ ...d, customers: d.customers.map(x => x.id === c.id ? c : x) }));
      toast({ message: `Updated ${c.name}`, tone: 'success' });
    } else {
      setData(d => ({ ...d, customers: [{ ...c, id: 'c' + Date.now(), isActive: true }, ...d.customers] }));
      toast({ message: `Added ${c.name}`, tone: 'success' });
    }
  };

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${filtered.length} active customers`}
        actions={role === 'admin' && <Button icon="plus" onClick={() => setAdding(true)}>Add customer</Button>}/>
      <div className="bg-white border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <div className="flex-1 max-w-md"><Input icon="search" placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)}/></div>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-[160px]">
            <option value="due">Sort: Due date</option>
            <option value="name">Sort: Name</option>
          </Select>
          <div className="ml-auto text-[12px] text-[var(--muted)]">{filtered.length} of {data.customers.filter(c => c.isActive).length}</div>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] bg-[var(--bg-soft)]">
              <th className="py-2.5 px-4 font-medium">Customer</th>
              <th className="py-2.5 px-4 font-medium">Phone</th>
              <th className="py-2.5 px-4 font-medium">Medicines</th>
              <th className="py-2.5 px-4 font-medium">Next due</th>
              <th className="py-2.5 px-4 font-medium">Status</th>
              {role === 'admin' && <th className="py-2.5 px-4 w-[80px]"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const d = daysFromToday(c.nextDueDate);
              const tone = d === null ? 'neutral' : d < 0 ? 'danger' : d === 0 ? 'danger' : d <= 2 ? 'warning' : d <= 7 ? 'brand' : 'neutral';
              const lbl = d === null ? '—' : d < 0 ? `${-d}d overdue` : d === 0 ? 'Due today' : d === 1 ? 'Tomorrow' : `In ${d} days`;
              return (
                <tr key={c.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-soft)]/60 group cursor-pointer" onClick={() => navigate('customer', c.id)}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center text-[11.5px] font-medium">{c.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
                      <div>
                        <div className="font-medium text-[var(--ink)] flex items-center gap-1.5">{c.name}{c.reminderIgnored && <span className="inline-flex items-center h-[18px] px-1.5 rounded text-[10px] uppercase tracking-[0.06em] font-medium bg-[var(--bg-soft)] text-[var(--muted)] border border-[var(--border)]">Ignored</span>}</div>
                        {c.notes && <div className="text-[11.5px] text-[var(--muted)] truncate max-w-[180px]">{c.notes}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[var(--ink-2)] tabular-nums">{c.phone}</td>
                  <td className="py-3 px-4 text-[var(--ink-2)]"><div className="max-w-[260px] truncate">{c.medicines.map(m => m.medicineName).join(', ')}</div></td>
                  <td className="py-3 px-4 text-[var(--ink-2)] tabular-nums">{fmtDateShort(c.nextDueDate)}</td>
                  <td className="py-3 px-4"><Badge tone={tone} dot>{lbl}</Badge></td>
                  {role === 'admin' && (
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconButton icon="edit" tone="brand" onClick={() => setEditing(c)}/>
                        <IconButton icon="trash" tone="danger" onClick={() => setConfirm(c)}/>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState icon="users" title="No customers found" body="Try a different search or add a new customer."/>}
      </div>

      <CustomerForm open={!!editing || adding} onClose={() => { setEditing(null); setAdding(false); }}
        existing={editing} medicines={data.medicines}
        onSave={(c) => { save(c); setEditing(null); setAdding(false); }}/>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        title={`Remove ${confirm?.name}?`}
        message="The customer will be soft-deleted. Their payment history is preserved but they'll no longer appear in lists or reminders."
        confirmLabel="Remove"
        onConfirm={() => { setData(d => ({ ...d, customers: d.customers.map(x => x.id === confirm.id ? { ...x, isActive: false } : x) })); toast({ message: 'Customer removed', tone: 'success' }); }}/>
    </div>
  );
};

// CustomerForm
const CustomerForm = ({ open, onClose, existing, medicines, onSave, onAddMedicine }) => {
  const [form, setForm] = uuS({ name: '', phone: '', altPhone: '', address: '', notes: '', medicines: [], nextDueDate: '' });
  uuE(() => {
    if (open) setForm(existing
      ? { ...existing, nextDueDate: toDateInputValue(existing.nextDueDate) }
      : { name: '', phone: '', altPhone: '', address: '', notes: '', medicines: [], nextDueDate: '' });
  }, [open, existing]);
  const [medSearch, setMedSearch] = uuS('');
  const medOptions = uuM(() => medicines.filter(m => !form.medicines.some(fm => fm.medicineName.toLowerCase() === m.name.toLowerCase()) && (medSearch ? m.name.toLowerCase().includes(medSearch.toLowerCase()) : true)).slice(0, 8), [medSearch, medicines, form.medicines]);
  const trimmed = medSearch.trim();
  const exactInCatalog = uuM(() => medicines.find(m => m.name.toLowerCase() === trimmed.toLowerCase()), [trimmed, medicines]);
  const alreadyAdded = uuM(() => form.medicines.some(fm => fm.medicineName.toLowerCase() === trimmed.toLowerCase()), [trimmed, form.medicines]);
  const canAddCustom = trimmed.length >= 2 && !exactInCatalog && !alreadyAdded;
  const addMed = (m) => { setForm(f => ({ ...f, medicines: [...f.medicines, { medicineName: m.name, medicineId: m.id, inCatalog: true }] })); setMedSearch(''); };
  const addCustomMed = () => {
    if (!canAddCustom) return;
    setForm(f => ({ ...f, medicines: [...f.medicines, { medicineName: trimmed, medicineId: null, inCatalog: false }] }));
    setMedSearch('');
  };
  const removeMed = (i) => setForm(f => ({ ...f, medicines: f.medicines.filter((_, idx) => idx !== i) }));
  const submit = () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    let iso = null;
    if (form.nextDueDate) {
      const d = new Date(form.nextDueDate);
      if (!isNaN(d.getTime())) iso = d.toISOString();
    }
    onSave({ ...form, nextDueDate: iso });
  };
  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit customer' : 'Add customer'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>{existing ? 'Save changes' : 'Add customer'}</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Full name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></Field>
        <Field label="Phone" required><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10 digits"/></Field>
        <Field label="Alternate phone"><Input value={form.altPhone} onChange={(e) => setForm({ ...form, altPhone: e.target.value })}/></Field>
        <Field label="Next due date"><Input type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}/></Field>
        <div className="col-span-2"><Field label="Address"><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}/></Field></div>
        <div className="col-span-2">
          <Field label="Medicines" hint="Type to search your catalog. Anything you add here stays on this customer only — it does not get added to the Medicines section.">
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[26px]">
              {form.medicines.map((m, i) => {
                const inCatalog = m.inCatalog ?? medicines.some(x => x.name.toLowerCase() === m.medicineName.toLowerCase());
                return (
                  <span key={i} className={`inline-flex items-center gap-1 rounded-md px-2 h-[26px] text-[12px] border ${inCatalog ? 'bg-[var(--brand-50)] text-[var(--brand-800)] border-[var(--brand-100)]' : 'bg-[color-mix(in_oklab,var(--warning)_10%,transparent)] text-[var(--warning-ink)] border-[color-mix(in_oklab,var(--warning)_25%,transparent)]'}`} title={inCatalog ? 'In catalog' : 'Not in your catalog'}>
                    {m.medicineName}
                    {!inCatalog && <span className="text-[10px] opacity-80">• not in catalog</span>}
                    <button type="button" onClick={() => removeMed(i)} className="hover:text-[var(--danger)]"><Icon name="x" size={12}/></button>
                  </span>
                );
              })}
              {form.medicines.length === 0 && <span className="text-[12px] text-[var(--muted)] italic">No medicines added yet</span>}
            </div>
            <div className="relative">
              <Input icon="search" placeholder="Search catalog, or type any medicine name…" value={medSearch} onChange={(e) => setMedSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canAddCustom) { e.preventDefault(); addCustomMed(); } }}/>
              {medSearch && (medOptions.length > 0 || canAddCustom) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-md shadow-lg z-10 overflow-hidden max-h-[260px] overflow-y-auto">
                  {medOptions.map(m => (
                    <button key={m.id} type="button"
                      onMouseDown={(e) => { e.preventDefault(); addMed(m); }}
                      onClick={(e) => { e.preventDefault(); addMed(m); }}
                      className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-[var(--bg-soft)] flex items-center justify-between">
                      <span className="text-[var(--ink)]">{m.name}</span>
                      <span className="text-[11.5px] text-[var(--muted)]">{m.content}</span>
                    </button>
                  ))}
                  {canAddCustom && (
                    <button type="button"
                      onMouseDown={(e) => { e.preventDefault(); addCustomMed(); }}
                      onClick={(e) => { e.preventDefault(); addCustomMed(); }}
                      className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] flex items-center justify-between ${medOptions.length > 0 ? 'border-t border-[var(--border)]' : ''}`}>
                      <span className="text-[var(--warning-ink)] font-medium">+ Add “{trimmed}” to this customer</span>
                      <span className="text-[11px] text-[var(--muted)]">Not in catalog · Enter</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </Field>
        </div>
        <div className="col-span-2"><Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything to remember about this customer…"/></Field></div>
      </div>
    </Modal>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// CUSTOMER DETAIL
// ────────────────────────────────────────────────────────────────────────────
const CustomerDetail = ({ data, setData, role, customerId, navigate }) => {
  const toast = useToast();
  const c = data.customers.find(x => x.id === customerId);
  const payments = uuM(() => data.payments.filter(p => p.customerId === customerId).sort((a, b) => new Date(b.date) - new Date(a.date)), [data.payments, customerId]);
  const [dueModal, setDueModal] = uuS(false);
  const [payModal, setPayModal] = uuS(false);
  const [editModal, setEditModal] = uuS(false);
  const [confirmPay, setConfirmPay] = uuS(null);
  if (!c) return <div className="text-[var(--muted)]">Customer not found</div>;

  const totalRecv = payments.filter(p => p.type === 'received').reduce((s, p) => s + p.amount, 0);
  const totalGiven = payments.filter(p => p.type === 'given').reduce((s, p) => s + p.amount, 0);
  const d = daysFromToday(c.nextDueDate);

  return (
    <div>
      <button onClick={() => navigate('customers')} className="flex items-center gap-1 text-[12.5px] text-[var(--muted)] hover:text-[var(--ink)] mb-4">
        <Icon name="chevL" size={13}/> Back to customers
      </button>
      <PageHeader
        eyebrow="Customer profile"
        title={<span className="inline-flex items-center gap-2 flex-wrap">{c.name}{c.reminderIgnored && <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-md text-[10.5px] uppercase tracking-[0.08em] font-medium bg-[var(--bg-soft)] text-[var(--muted)] border border-[var(--border)]"><Icon name="bell" size={10}/>Ignored from reminders</span>}</span>}
        subtitle={c.notes || 'No notes recorded'}
        actions={role === 'admin' && <>
          <Button variant="secondary" icon="edit" onClick={() => setEditModal(true)}>Edit profile</Button>
          <Button icon="calendar" onClick={() => setDueModal(true)}>Update due date</Button>
        </>}/>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="bg-white border border-[var(--border)] rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mb-3">Contact</div>
          <ul className="flex flex-col gap-2.5 text-[13px]">
            <li className="flex items-center gap-2.5 text-[var(--ink-2)]"><Icon name="phone" size={13} className="text-[var(--muted)]"/><span className="tabular-nums">{c.phone}</span></li>
            {c.altPhone && <li className="flex items-center gap-2.5 text-[var(--ink-2)]"><Icon name="phone" size={13} className="text-[var(--muted)]"/><span className="tabular-nums">{c.altPhone}</span> <span className="text-[11px] text-[var(--muted)]">alt</span></li>}
            {c.address && <li className="flex items-start gap-2.5 text-[var(--ink-2)]"><Icon name="pin" size={13} className="text-[var(--muted)] mt-0.5"/><span>{c.address}</span></li>}
          </ul>
        </div>
        <div className="bg-white border border-[var(--border)] rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mb-3">Next refill</div>
          <div className="flex items-baseline gap-3">
            <div className="text-[24px] font-semibold tracking-tight text-[var(--ink)]">{fmtDate(c.nextDueDate)}</div>
            {d !== null && <Badge tone={d < 0 ? 'danger' : d <= 2 ? 'warning' : 'brand'} dot>{d < 0 ? `${-d}d overdue` : d === 0 ? 'Due today' : d === 1 ? 'Tomorrow' : `In ${d} days`}</Badge>}
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--border)] text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mb-2">Medicines</div>
          <div className="flex flex-wrap gap-1.5">
            {c.medicines.map((m, i) => <Badge key={i} tone="brand">{m.medicineName}</Badge>)}
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
          <div className="mt-3 pt-3 border-t border-[var(--border)] text-[11px] text-[var(--muted)]">{payments.length} record{payments.length === 1 ? '' : 's'} on file</div>
        </div>
      </div>

      <div className="bg-white border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
          <div>
            <div className="text-[14px] font-semibold text-[var(--ink)]">Payment records</div>
            <div className="text-[12px] text-[var(--muted)]">Manual ledger — offline transactions only</div>
          </div>
          {role === 'admin' && <Button icon="plus" size="sm" onClick={() => setPayModal(true)}>Add record</Button>}
        </div>
        {payments.length === 0 ? (
          <EmptyState icon="wallet" title="No payment records yet" body="Add a record when this customer pays in person."/>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] bg-[var(--bg-soft)]">
                <th className="py-2.5 px-5 font-medium">Date</th>
                <th className="py-2.5 px-5 font-medium">Type</th>
                <th className="py-2.5 px-5 font-medium text-right">Amount</th>
                <th className="py-2.5 px-5 font-medium">Note</th>
                {role === 'admin' && <th className="py-2.5 px-5 w-[60px]"></th>}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-soft)]/60 group">
                  <td className="py-3 px-5 text-[var(--ink-2)] tabular-nums">{fmtDate(p.date)}</td>
                  <td className="py-3 px-5"><Badge tone={p.type === 'received' ? 'success' : 'danger'} dot>{p.type === 'received' ? 'Received' : 'Given'}</Badge></td>
                  <td className={`py-3 px-5 text-right tabular-nums font-semibold ${p.type === 'received' ? 'text-[var(--success-ink)]' : 'text-[var(--danger-ink)]'}`}>
                    {p.type === 'received' ? '+' : '−'}{fmtINR(p.amount)}
                  </td>
                  <td className="py-3 px-5 text-[var(--ink-2)] italic">{p.note || <span className="text-[var(--muted)] not-italic">—</span>}</td>
                  {role === 'admin' && (
                    <td className="py-3 px-5">
                      <div className="opacity-0 group-hover:opacity-100"><IconButton icon="trash" tone="danger" onClick={() => setConfirmPay(p)}/></div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DueDateModal open={dueModal} onClose={() => setDueModal(false)} customer={c}
        onSave={(date) => { const dt = new Date(date); if (isNaN(dt.getTime())) return; setData(d => ({ ...d, customers: d.customers.map(x => x.id === c.id ? { ...x, nextDueDate: dt.toISOString(), reminderIgnored: false, autoReminderSentForCycle: false, autoReminderSentAt: null } : x) })); toast({ message: 'Due date updated', tone: 'success' }); setDueModal(false); }}/>
      <PaymentModal open={payModal} onClose={() => setPayModal(false)} customerName={c.name}
        onSave={(p) => { setData(d => ({ ...d, payments: [{ ...p, id: 'p' + Date.now(), customerId: c.id }, ...d.payments] })); toast({ message: 'Payment recorded', tone: 'success' }); setPayModal(false); }}/>
      <CustomerForm open={editModal} onClose={() => setEditModal(false)} existing={c} medicines={data.medicines}
        onSave={(updated) => { setData(d => ({ ...d, customers: d.customers.map(x => x.id === c.id ? { ...updated, reminderIgnored: updated.nextDueDate !== c.nextDueDate ? false : x.reminderIgnored, autoReminderSentForCycle: updated.nextDueDate !== c.nextDueDate ? false : x.autoReminderSentForCycle, autoReminderSentAt: updated.nextDueDate !== c.nextDueDate ? null : x.autoReminderSentAt } : x) })); toast({ message: 'Profile updated', tone: 'success' }); setEditModal(false); }}/>
      <ConfirmDialog open={!!confirmPay} onClose={() => setConfirmPay(null)}
        title="Delete payment record?" message="This will permanently remove the record from the ledger."
        confirmLabel="Delete"
        onConfirm={() => { setData(d => ({ ...d, payments: d.payments.filter(p => p.id !== confirmPay.id) })); toast({ message: 'Record deleted', tone: 'success' }); }}/>
    </div>
  );
};

const DueDateModal = ({ open, onClose, customer, onSave }) => {
  const [date, setDate] = uuS('');
  uuE(() => { if (open) setDate(toDateInputValue(customer?.nextDueDate)); }, [open, customer]);
  return (
    <Modal open={open} onClose={onClose} title="Update next due date" size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!date} onClick={() => { if (!date) return; const dt = new Date(date); if (isNaN(dt.getTime())) return; onSave(date); }}>Save</Button></>}>
      <Field label="Next due date" hint="When should we remind this customer next?">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}/>
      </Field>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[7, 15, 30, 45, 60, 90].map(n => {
          const d = new Date(); d.setDate(d.getDate() + n);
          return <button key={n} onClick={() => setDate(d.toISOString().slice(0, 10))} className="px-2.5 h-7 rounded-md border border-[var(--border)] text-[12px] text-[var(--ink-2)] hover:bg-[var(--brand-50)] hover:border-[var(--brand-300)] hover:text-[var(--brand-800)]">+{n} days</button>;
        })}
      </div>
    </Modal>
  );
};

const PaymentModal = ({ open, onClose, customerName, onSave }) => {
  const [form, setForm] = uuS({ amount: '', type: 'received', note: '', date: '' });
  uuE(() => { if (open) setForm({ amount: '', type: 'received', note: '', date: new Date().toISOString().slice(0, 10) }); }, [open]);
  const submit = () => {
    if (!form.amount) return;
    const dt = new Date(form.date);
    onSave({ ...form, amount: Number(form.amount), date: isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString() });
  };
  return (
    <Modal open={open} onClose={onClose} title="Add payment record" subtitle={customerName ? `For ${customerName}` : null} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Save record</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Type" required>
          <div className="flex gap-2">
            {[
              { v: 'received', l: 'Received', icon: 'arrowDown', tone: 'success' },
              { v: 'given',    l: 'Given',    icon: 'arrowUp',   tone: 'danger' },
            ].map(o => (
              <button key={o.v} onClick={() => setForm({ ...form, type: o.v })}
                className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-md border text-[13px] transition-colors ${form.type === o.v
                  ? (o.v === 'received' ? 'border-[var(--success)] bg-[color-mix(in_oklab,var(--success)_10%,transparent)] text-[var(--success-ink)]' : 'border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] text-[var(--danger-ink)]')
                  : 'border-[var(--border)] text-[var(--ink-2)] hover:bg-[var(--bg-soft)]'}`}>
                <Icon name={o.icon} size={14}/>{o.l}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Amount (₹)" required><Input type="number" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0"/></Field>
        <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}/></Field>
        <Field label="Note" hint="Optional"><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. paid for Feb medicines"/></Field>
      </div>
    </Modal>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// REMINDERS
// ────────────────────────────────────────────────────────────────────────────
const Reminders = ({ data, setData, role, navigate }) => {
  const toast = useToast();
  const due = uuM(() => data.customers.filter(c => { const d = daysFromToday(c.nextDueDate); return c.isActive && !c.reminderIgnored && d !== null && d >= -1 && d <= 2; }).sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate)), [data.customers]);
  const [completing, setCompleting] = uuS(null);
  const [waPreview, setWaPreview] = uuS(null);
  const [menuOpen, setMenuOpen] = uuS(null); // customerId for which split menu is open
  const sentMap = uuS(() => new Set())[0]; // not really used for state; placeholder
  const [sentRecord, setSentRecord] = uuS({}); // customerId -> true once "sent"
  const [autoSendNotice, setAutoSendNotice] = uuS(null); // {count, names} after auto-send fires

  // Auto-send first reminder of the cycle for newly-due customers (once per cycle).
  // Skips: no phone, no medicines, already auto-sent this cycle.
  uuE(() => {
    const candidates = due.filter(c => !c.autoReminderSentForCycle && c.phone && c.medicines && c.medicines.length > 0);
    if (candidates.length === 0) return;
    const stamp = new Date().toISOString();
    const ids = new Set(candidates.map(c => c.id));
    setData(d => ({ ...d, customers: d.customers.map(x => ids.has(x.id) ? { ...x, autoReminderSentForCycle: true, autoReminderSentAt: stamp } : x) }));
    setAutoSendNotice({ count: candidates.length, names: candidates.map(c => c.name).slice(0, 3) });
  }, [due.length]);  // re-run only when the eligible list changes size

  uuE(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const sendWA = (c) => setWaPreview(c);
  const confirmSend = (c) => {
    const link = buildWhatsAppLink(c.phone, c.name, c.medicines, c.nextDueDate);
    window.open(link, '_blank');
    setSentRecord(s => ({ ...s, [c.id]: true }));
    toast({ message: `WhatsApp opened for ${c.name}`, tone: 'success' });
    setWaPreview(null);
  };

  const ignoreCustomer = (c) => {
    setData(d => ({ ...d, customers: d.customers.map(x => x.id === c.id ? { ...x, reminderIgnored: true } : x) }));
    toast({ message: `${c.name} removed from reminders · returns when due date is updated`, tone: 'success' });
    setMenuOpen(null);
  };

  return (
    <div>
      <PageHeader title="Reminders" subtitle="Customers due in the next 48 hours · WhatsApp messages auto-generated daily at 10 AM"
        actions={<Badge tone="brand" dot>{due.length} pending</Badge>}/>
      {autoSendNotice && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)]">
          <div className="w-7 h-7 rounded-full bg-white border border-[var(--success-border)] flex items-center justify-center shrink-0 mt-0.5">
            <Icon name="whatsapp" size={13} className="text-[var(--success-ink)]"/>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-[var(--success-ink)]">First-time reminder auto-sent to {autoSendNotice.count} {autoSendNotice.count === 1 ? 'customer' : 'customers'}</div>
            <div className="text-[12px] text-[var(--success-ink)]/80 mt-0.5">{autoSendNotice.names.join(', ')}{autoSendNotice.count > autoSendNotice.names.length && ` and ${autoSendNotice.count - autoSendNotice.names.length} more`} · sent at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      )}
      {due.length === 0 ? (
        <EmptyState icon="bell" title="All caught up" body="No reminders due right now. New ones surface daily at 10 AM."/>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {due.map(c => {
            const d = daysFromToday(c.nextDueDate);
            const tone = d < 0 ? 'danger' : d === 0 ? 'danger' : d === 1 ? 'warning' : 'brand';
            const lbl = d < 0 ? `${-d} day overdue` : d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : `Due in ${d} days`;
            const sent = sentRecord[c.id];
            const autoSent = c.autoReminderSentForCycle;
            const unreachable = !c.phone;
            return (
              <div key={c.id} className="bg-white border border-[var(--border)] rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center text-[12.5px] font-medium shrink-0">{c.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
                    <div className="min-w-0">
                      <button onClick={() => navigate('customer', c.id)} className="font-medium text-[var(--ink)] hover:underline truncate text-left">{c.name}</button>
                      <div className="text-[12px] text-[var(--muted)] tabular-nums">{c.phone}</div>
                    </div>
                  </div>
                  <Badge tone={tone} dot>{lbl}</Badge>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.1em] font-medium text-[var(--muted)] mb-1.5">Medicines</div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.medicines.map((m, i) => (
                      <span key={i} className="inline-flex items-center h-7 px-2.5 rounded-md bg-[var(--brand-50)] text-[var(--brand-800)] border border-[var(--brand-100)] text-[12.5px] font-medium">
                        {m.medicineName}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] gap-2">
                  <div className="text-[11.5px] text-[var(--muted)] min-w-0">
                    {unreachable ? (
                      <span className="inline-flex items-center gap-1 text-[var(--danger-ink)]"><Icon name="alert" size={11}/> Unreachable · no phone</span>
                    ) : autoSent ? (
                      <span className="inline-flex items-center gap-1 text-[var(--success-ink)]"><Icon name="check" size={11}/> Auto-sent · {new Date(c.autoReminderSentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    ) : (
                      <><span className="uppercase tracking-[0.08em]">Due</span> · <span className="text-[var(--ink-2)] tabular-nums">{fmtDate(c.nextDueDate)}</span></>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant={(autoSent || sent) ? 'secondary' : 'success'} icon="whatsapp" onClick={() => sendWA(c)} disabled={unreachable}>
                      {autoSent || sent ? 'Resend' : 'Send WhatsApp'}
                    </Button>
                    {role === 'admin' && (
                      <div className="relative inline-flex">
                        <button onClick={() => setCompleting(c)} className="inline-flex items-center gap-1 h-8 px-3 rounded-l-md border border-r-0 border-[var(--border)] bg-white text-[12.5px] text-[var(--ink)] hover:bg-[var(--bg-soft)] transition-colors">
                          <Icon name="check" size={13}/> Mark complete
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === c.id ? null : c.id); }} aria-label="More actions"
                          className="inline-flex items-center justify-center w-7 h-8 rounded-r-md border border-[var(--border)] bg-white text-[var(--ink-2)] hover:bg-[var(--bg-soft)] transition-colors">
                          <Icon name="chevD" size={13}/>
                        </button>
                        {menuOpen === c.id && (
                          <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-1 w-52 bg-white border border-[var(--border)] rounded-md shadow-lg z-20 overflow-hidden">
                            <button onClick={() => { setMenuOpen(null); setCompleting(c); }} className="w-full text-left px-3 py-2.5 text-[12.5px] hover:bg-[var(--bg-soft)] flex items-start gap-2.5">
                              <Icon name="check" size={13} className="mt-0.5 text-[var(--success-ink)]"/>
                              <div>
                                <div className="font-medium text-[var(--ink)]">Mark complete</div>
                                <div className="text-[11px] text-[var(--muted)]">Customer purchased — set next due date</div>
                              </div>
                            </button>
                            <button onClick={() => ignoreCustomer(c)} className="w-full text-left px-3 py-2.5 text-[12.5px] hover:bg-[var(--bg-soft)] border-t border-[var(--border)] flex items-start gap-2.5">
                              <Icon name="bell" size={13} className="mt-0.5 text-[var(--muted)]"/>
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

      <Modal open={!!waPreview} onClose={() => setWaPreview(null)} title="WhatsApp message preview" subtitle={waPreview ? `Will be sent to ${waPreview.name} (${waPreview.phone})` : ''} size="md"
        footer={<><Button variant="secondary" onClick={() => setWaPreview(null)}>Cancel</Button><Button variant="success" icon="whatsapp" onClick={() => confirmSend(waPreview)}>Open in WhatsApp</Button></>}>
        {waPreview && (
          <div>
            <div className="rounded-lg overflow-hidden border border-[var(--border)]" style={{ background: '#e5ddd5' }}>
              <div className="px-4 py-2.5 flex items-center gap-2 text-white" style={{ background: '#075e54' }}>
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-medium">{waPreview.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
                <div>
                  <div className="text-[13px] font-medium">{waPreview.name}</div>
                  <div className="text-[10.5px] opacity-80 tabular-nums">+91 {waPreview.phone}</div>
                </div>
              </div>
              <div className="p-4 min-h-[140px] flex flex-col gap-2">
                <div className="self-end max-w-[80%] bg-[#dcf8c6] rounded-lg rounded-br-sm px-3 py-2 text-[12.5px] text-[#0b1d18] shadow-sm leading-relaxed">
                  Hello {waPreview.name}, this is a reminder from PharmaCare — your medicine refill ({waPreview.medicines.map(m => m.medicineName).join(', ')}) is due on {fmtDate(waPreview.nextDueDate)}. Please visit us to collect your prescription. Thank you.
                  <div className="text-right text-[10px] text-black/45 mt-1">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            </div>
            <div className="mt-3 px-3 py-2 rounded-md bg-[var(--bg-soft)] border border-[var(--border)] text-[11.5px] text-[var(--muted)] font-mono break-all">
              {buildWhatsAppLink(waPreview.phone, waPreview.name, waPreview.medicines, waPreview.nextDueDate)}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!completing} onClose={() => setCompleting(null)} title="Mark refill complete" subtitle={completing ? `Set ${completing.name}'s next due date` : ''} size="md"
        footer={<><Button variant="secondary" onClick={() => setCompleting(null)}>Cancel</Button><Button variant="success" onClick={() => {
          const newDate = document.getElementById('__newDue').value;
          if (!newDate) return;
          const dt = new Date(newDate);
          if (isNaN(dt.getTime())) return;
          const sendThanks = document.getElementById('__sendThanks')?.checked;
          setData(d => ({ ...d, customers: d.customers.map(x => x.id === completing.id ? { ...x, nextDueDate: dt.toISOString(), reminderIgnored: false, autoReminderSentForCycle: false, autoReminderSentAt: null } : x) }));
          if (sendThanks) {
            const link = buildThankYouLink(completing.phone, completing.name, completing.medicines, dt.toISOString());
            window.open(link, '_blank');
            toast({ message: `${completing.name} — refill complete · thank-you sent`, tone: 'success' });
          } else {
            toast({ message: `${completing.name} — refill complete`, tone: 'success' });
          }
          setCompleting(null);
        }}>Complete & save</Button></>}>
        {completing && (
          <div className="flex flex-col gap-4">
            <div className="text-[12.5px] text-[var(--ink-2)]">Reminder marked as completed. When should we remind {completing.name.split(' ')[0]} again?</div>
            <Field label="New next due date">
              <Input id="__newDue" type="date" defaultValue={(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })()} onChange={(e) => {
                const previewEl = document.getElementById('__thankPreview');
                if (previewEl && e.target.value) {
                  const dt = new Date(e.target.value);
                  if (!isNaN(dt.getTime())) previewEl.textContent = buildThankYouMessage(completing.name, completing.medicines, dt.toISOString());
                }
              }}/>
            </Field>
            <div className="flex flex-col gap-2 p-3 rounded-md border border-[var(--border)] bg-[var(--bg-soft)]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input id="__sendThanks" type="checkbox" defaultChecked className="accent-[var(--brand-700)] w-4 h-4"/>
                <span className="text-[12.5px] font-medium text-[var(--ink)]">Send thank-you on WhatsApp</span>
              </label>
              <div className="rounded-md border border-[var(--border)] overflow-hidden" style={{ background: '#e5ddd5' }}>
                <div className="px-3 py-2 flex items-center gap-2 text-white" style={{ background: '#075e54' }}>
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-medium">{completing.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
                  <div className="text-[11.5px] font-medium">{completing.name}</div>
                </div>
                <div className="p-3 flex flex-col gap-1">
                  <div className="self-end max-w-[85%] bg-[#dcf8c6] rounded-lg rounded-br-sm px-2.5 py-1.5 text-[11.5px] text-[#0b1d18] shadow-sm leading-relaxed">
                    <span id="__thankPreview">{buildThankYouMessage(completing.name, completing.medicines, (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString(); })())}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// PAYMENTS LIST
// ────────────────────────────────────────────────────────────────────────────
const PaymentList = ({ data, setData, role, navigate }) => {
  const toast = useToast();
  const [q, setQ] = uuS('');
  const [tab, setTab] = uuS('regulars');
  const [walkInOpen, setWalkInOpen] = uuS(false);
  const [convertTarget, setConvertTarget] = uuS(null);

  const regulars = uuM(() => {
    return data.customers.filter(c => c.isActive).map(c => {
      const ps = data.payments.filter(p => p.customerId === c.id);
      const recv = ps.filter(p => p.type === 'received').reduce((s, p) => s + p.amount, 0);
      const giv = ps.filter(p => p.type === 'given').reduce((s, p) => s + p.amount, 0);
      const last = ps.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      return { ...c, recv, giv, count: ps.length, last };
    }).filter(c => q ? c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q) : true)
      .sort((a, b) => b.count - a.count);
  }, [data, q]);

  const walkIns = uuM(() => data.payments.filter(p => p.walkIn)
    .filter(p => q ? (p.walkInName || '').toLowerCase().includes(q.toLowerCase()) || (p.walkInPhone || '').includes(q) : true)
    .sort((a, b) => new Date(b.date) - new Date(a.date)),
  [data.payments, q]);

  const totalRecv = data.payments.filter(p => p.type === 'received').reduce((s, p) => s + p.amount, 0);
  const totalGiv = data.payments.filter(p => p.type === 'given').reduce((s, p) => s + p.amount, 0);
  const walkInDue = data.payments.filter(p => p.walkIn && p.type === 'received' && p.due).reduce((s, p) => s + p.amount, 0);

  const saveWalkIn = (p) => {
    setData(d => ({ ...d, payments: [{ ...p, id: 'p' + Date.now(), customerId: null, walkIn: true }, ...d.payments] }));
    toast({ message: 'Walk-in payment recorded', tone: 'success' });
    setWalkInOpen(false);
  };

  const convertWalkIn = (target, customerData) => {
    const newCustomer = {
      ...customerData,
      id: 'c' + Date.now(),
      isActive: true,
      medicines: [],
      altPhone: '',
      address: '',
      notes: 'Converted from walk-in',
      nextDueDate: null,
    };
    // Re-attach all walk-in payments with same name+phone to this new customer
    setData(d => ({
      ...d,
      customers: [newCustomer, ...d.customers],
      payments: d.payments.map(p =>
        (p.walkIn && p.walkInName === target.walkInName && p.walkInPhone === target.walkInPhone)
          ? { ...p, customerId: newCustomer.id, walkIn: false, walkInName: undefined, walkInPhone: undefined }
          : p
      ),
    }));
    toast({ message: `${customerData.name} added to customers`, tone: 'success' });
    setConvertTarget(null);
  };

  return (
    <div>
      <PageHeader title="Payments" subtitle="Manual ledger of all customer transactions"
        actions={<Button icon="plus" onClick={() => setWalkInOpen(true)}>Add walk-in payment</Button>}/>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Received" value={fmtINR(totalRecv)} sub={`${data.payments.filter(p => p.type === 'received').length} entries`} icon="arrowDown" tone="success"/>
        <StatCard label="Total Given" value={fmtINR(totalGiv)} sub={`${data.payments.filter(p => p.type === 'given').length} entries`} icon="arrowUp" tone="danger"/>
        <StatCard label="Net Position" value={fmtINR(totalRecv - totalGiv)} sub="Across all customers" icon="wallet"/>
        <StatCard label="Walk-in Due" value={fmtINR(walkInDue)} sub={`${data.payments.filter(p => p.walkIn && p.due).length} pending`} icon="user" tone={walkInDue > 0 ? 'warning' : 'neutral'}/>
      </div>

      <div className="flex items-center gap-1 bg-[var(--bg-soft)] border border-[var(--border)] p-1 rounded-md w-fit mb-4">
        {[
          { v: 'regulars', l: 'Regular customers', n: regulars.length },
          { v: 'walkins', l: 'Walk-in payments', n: walkIns.length },
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v)} className={`flex items-center gap-2 px-3 h-8 rounded text-[12.5px] font-medium transition-colors ${tab === t.v ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {t.l} <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] flex items-center justify-center bg-[var(--bg)] text-[var(--muted)]">{t.n}</span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <div className="flex-1 max-w-md"><Input icon="search" placeholder={tab === 'regulars' ? 'Search customer…' : 'Search walk-in by name or phone…'} value={q} onChange={(e) => setQ(e.target.value)}/></div>
          <div className="ml-auto text-[12px] text-[var(--muted)]">{tab === 'regulars' ? regulars.length + ' customers' : walkIns.length + ' records'}</div>
        </div>
        {tab === 'regulars' ? (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] bg-[var(--bg-soft)]">
                <th className="py-2.5 px-4 font-medium">Customer</th>
                <th className="py-2.5 px-4 font-medium text-right">Records</th>
                <th className="py-2.5 px-4 font-medium text-right">Received</th>
                <th className="py-2.5 px-4 font-medium text-right">Given</th>
                <th className="py-2.5 px-4 font-medium">Last record</th>
                <th className="py-2.5 px-4 font-medium w-[20px]"></th>
              </tr>
            </thead>
            <tbody>
              {regulars.map(c => (
                <tr key={c.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-soft)]/60 cursor-pointer" onClick={() => navigate('customer', c.id)}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center text-[11px] font-medium">{c.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
                      <div className="font-medium text-[var(--ink)]">{c.name}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-[var(--ink-2)] tabular-nums">{c.count}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-[var(--success-ink)] font-medium">{c.recv ? fmtINR(c.recv) : <span className="text-[var(--muted)] font-normal">—</span>}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-[var(--danger-ink)] font-medium">{c.giv ? fmtINR(c.giv) : <span className="text-[var(--muted)] font-normal">—</span>}</td>
                  <td className="py-3 px-4 text-[var(--ink-2)] tabular-nums">{c.last ? fmtDateShort(c.last.date) : <span className="text-[var(--muted)]">No records</span>}</td>
                  <td className="py-3 px-4 text-[var(--muted)]"><Icon name="chevR" size={13}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] bg-[var(--bg-soft)]">
                <th className="py-2.5 px-4 font-medium">Walk-in name</th>
                <th className="py-2.5 px-4 font-medium">Phone</th>
                <th className="py-2.5 px-4 font-medium">Date</th>
                <th className="py-2.5 px-4 font-medium">Type</th>
                <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium">Note</th>
                <th className="py-2.5 px-4 font-medium w-[140px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {walkIns.map(p => (
                <tr key={p.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-soft)]/60 group">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[var(--bg-soft)] text-[var(--muted)] flex items-center justify-center text-[11px] font-medium border border-[var(--border)]">{(p.walkInName || '?').split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
                      <div className="font-medium text-[var(--ink)]">{p.walkInName || <span className="text-[var(--muted)] italic">No name</span>}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[var(--ink-2)] tabular-nums">{p.walkInPhone || <span className="text-[var(--muted)]">—</span>}</td>
                  <td className="py-3 px-4 text-[var(--ink-2)] tabular-nums">{fmtDateShort(p.date)}</td>
                  <td className="py-3 px-4"><Badge tone={p.type === 'received' ? 'success' : 'danger'} dot>{p.type === 'received' ? 'Received' : 'Given'}</Badge></td>
                  <td className={`py-3 px-4 text-right tabular-nums font-semibold ${p.type === 'received' ? 'text-[var(--success-ink)]' : 'text-[var(--danger-ink)]'}`}>
                    {p.type === 'received' ? '+' : '−'}{fmtINR(p.amount)}
                  </td>
                  <td className="py-3 px-4">
                    {p.due
                      ? <Badge tone="warning" dot>Due</Badge>
                      : <Badge tone="success" dot>Settled</Badge>}
                  </td>
                  <td className="py-3 px-4 text-[var(--ink-2)] italic max-w-[200px] truncate">{p.note || <span className="text-[var(--muted)] not-italic">—</span>}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.due && <Button size="sm" variant="success" onClick={() => setData(d => ({ ...d, payments: d.payments.map(x => x.id === p.id ? { ...x, due: false } : x) }))}>Mark settled</Button>}
                      <Button size="sm" variant="secondary" onClick={() => setConvertTarget(p)}>Convert</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'walkins' && walkIns.length === 0 && <EmptyState icon="user" title="No walk-in payments yet" body="Record a one-off payment for a customer who isn’t in your monthly list." action={<Button icon="plus" onClick={() => setWalkInOpen(true)}>Add walk-in payment</Button>}/>}
      </div>

      <WalkInPaymentModal open={walkInOpen} onClose={() => setWalkInOpen(false)} onSave={saveWalkIn}/>
      <ConvertWalkInModal open={!!convertTarget} target={convertTarget} onClose={() => setConvertTarget(null)} onConfirm={convertWalkIn}/>
    </div>
  );
};

const WalkInPaymentModal = ({ open, onClose, onSave }) => {
  const [form, setForm] = uuS({ walkInName: '', walkInPhone: '', amount: '', type: 'received', due: true, note: '', date: '' });
  const [errors, setErrors] = uuS({});
  uuE(() => { if (open) { setForm({ walkInName: '', walkInPhone: '', amount: '', type: 'received', due: true, note: '', date: new Date().toISOString().slice(0, 10) }); setErrors({}); } }, [open]);
  const submit = () => {
    const e = {};
    if (!form.walkInName.trim()) e.walkInName = 'Required';
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Enter an amount greater than 0';
    setErrors(e);
    if (Object.keys(e).length) return;
    const dt = new Date(form.date);
    onSave({ ...form, amount: Number(form.amount), date: isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString() });
  };
  return (
    <Modal open={open} onClose={onClose} title="Add walk-in payment" subtitle="Record a one-off transaction without adding the person as a regular customer." size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Save record</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Person's name" required error={errors.walkInName}><Input value={form.walkInName} onChange={(e) => setForm({ ...form, walkInName: e.target.value })} placeholder="e.g. Suresh (camp area)" error={errors.walkInName}/></Field>
        <Field label="Phone" hint="Optional"><Input value={form.walkInPhone} onChange={(e) => setForm({ ...form, walkInPhone: e.target.value })} placeholder="Optional"/></Field>
        <div className="col-span-2">
          <Field label="Type" required>
            <div className="flex gap-2">
              {[{ v: 'received', l: 'Received', icon: 'arrowDown' }, { v: 'given', l: 'Given', icon: 'arrowUp' }].map(o => (
                <button key={o.v} type="button" onClick={() => setForm({ ...form, type: o.v })}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-md border text-[13px] transition-colors ${form.type === o.v
                    ? (o.v === 'received' ? 'border-[var(--success)] bg-[color-mix(in_oklab,var(--success)_10%,transparent)] text-[var(--success-ink)]' : 'border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] text-[var(--danger-ink)]')
                    : 'border-[var(--border)] text-[var(--ink-2)] hover:bg-[var(--bg-soft)]'}`}>
                  <Icon name={o.icon} size={14}/>{o.l}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <Field label="Amount (₹)" required error={errors.amount}><Input type="number" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" error={errors.amount}/></Field>
        <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}/></Field>
        <div className="col-span-2">
          <label className="flex items-center gap-2 text-[12.5px] text-[var(--ink-2)] cursor-pointer">
            <input type="checkbox" className="accent-[var(--brand-700)]" checked={form.due} onChange={(e) => setForm({ ...form, due: e.target.checked })}/>
            Mark this as a <b>due / pending</b> payment (uncheck if already settled in cash)
          </label>
        </div>
        <div className="col-span-2"><Field label="Note" hint="Optional — what was this for?"><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Cough syrup + paracetamol, said will pay tomorrow"/></Field></div>
      </div>
    </Modal>
  );
};

const ConvertWalkInModal = ({ open, target, onClose, onConfirm }) => {
  const [form, setForm] = uuS({ name: '', phone: '' });
  uuE(() => { if (open && target) setForm({ name: target.walkInName || '', phone: target.walkInPhone || '' }); }, [open, target]);
  if (!target) return null;
  return (
    <Modal open={open} onClose={onClose} title="Convert to regular customer" subtitle="Move all walk-in records under this name into a new customer profile." size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => onConfirm(target, form)} disabled={!form.name.trim() || !form.phone.trim()}>Create customer</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Full name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></Field>
        <Field label="Phone" required><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10 digits"/></Field>
        <div className="text-[11.5px] text-[var(--muted)] px-3 py-2 rounded-md bg-[var(--bg-soft)] border border-[var(--border)]">
          All walk-in payments tagged as <b>{target.walkInName}</b>{target.walkInPhone ? ` (${target.walkInPhone})` : ''} will be re-linked to the new customer.
        </div>
      </div>
    </Modal>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// EMPLOYEES
// ────────────────────────────────────────────────────────────────────────────
const EmployeeManagement = ({ data, setData }) => {
  const toast = useToast();
  const [tab, setTab] = uuS('all');
  const [confirm, setConfirm] = uuS(null);
  const pending = data.employees.filter(e => !e.isApproved);
  const all = data.employees;
  const list = tab === 'pending' ? pending : all;

  return (
    <div>
      <PageHeader title="Employees" subtitle="Manage staff access and approvals"/>
      <div className="flex items-center gap-1 bg-[var(--bg-soft)] border border-[var(--border)] p-1 rounded-md w-fit mb-4">
        {[
          { v: 'all', l: 'All employees', n: all.length },
          { v: 'pending', l: 'Pending approval', n: pending.length, badge: pending.length > 0 },
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v)} className={`flex items-center gap-2 px-3 h-8 rounded text-[12.5px] font-medium transition-colors ${tab === t.v ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {t.l} <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] flex items-center justify-center ${t.badge ? 'bg-[var(--danger)] text-white' : 'bg-[var(--bg)] text-[var(--muted)]'}`}>{t.n}</span>
          </button>
        ))}
      </div>
      <div className="bg-white border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] bg-[var(--bg-soft)]">
              <th className="py-2.5 px-4 font-medium">Name</th>
              <th className="py-2.5 px-4 font-medium">Email</th>
              <th className="py-2.5 px-4 font-medium">Phone</th>
              <th className="py-2.5 px-4 font-medium">Role</th>
              <th className="py-2.5 px-4 font-medium">Status</th>
              <th className="py-2.5 px-4 font-medium">Joined</th>
              <th className="py-2.5 px-4 font-medium w-[180px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(e => (
              <tr key={e.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-soft)]/60">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center text-[11px] font-medium">{e.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
                    <div className="font-medium text-[var(--ink)]">{e.name}</div>
                  </div>
                </td>
                <td className="py-3 px-4 text-[var(--ink-2)]">{e.email}</td>
                <td className="py-3 px-4 text-[var(--ink-2)] tabular-nums">{e.phone}</td>
                <td className="py-3 px-4"><Badge tone={e.role === 'admin' ? 'brand' : 'neutral'}>{e.role === 'admin' ? 'Admin' : 'Employee'}</Badge></td>
                <td className="py-3 px-4"><Badge tone={e.isApproved ? 'success' : 'warning'} dot>{e.isApproved ? 'Active' : 'Pending'}</Badge></td>
                <td className="py-3 px-4 text-[var(--ink-2)] tabular-nums">{fmtDateShort(e.createdAt)}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1.5">
                    {!e.isApproved && (
                      <Button size="sm" variant="success" icon="check" onClick={() => {
                        setData(d => ({ ...d, employees: d.employees.map(x => x.id === e.id ? { ...x, isApproved: true } : x) }));
                        toast({ message: `${e.name} approved`, tone: 'success' });
                      }}>Approve</Button>
                    )}
                    {e.role !== 'admin' && <Button size="sm" variant="secondary" onClick={() => setConfirm(e)}>Remove</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <EmptyState icon="users" title={tab === 'pending' ? 'No pending approvals' : 'No employees'} body={tab === 'pending' ? 'All staff accounts are approved.' : ''}/>}
      </div>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        title={`Remove ${confirm?.name}?`}
        message="Their access will be revoked immediately. This action cannot be undone."
        confirmLabel="Remove access"
        onConfirm={() => { setData(d => ({ ...d, employees: d.employees.filter(x => x.id !== confirm.id) })); toast({ message: 'Employee removed', tone: 'success' }); }}/>
    </div>
  );
};

Object.assign(window, { CustomerList, CustomerDetail, Reminders, PaymentList, EmployeeManagement });
