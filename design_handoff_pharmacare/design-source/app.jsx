// app.jsx — root layout, routing, tweaks

const { useState: aS, useEffect: aE, useMemo: aM } = React;

// THEMES
const THEMES = {
  teal: {
    name: 'Clinical Teal',
    vars: {
      '--brand-50':  'oklch(0.97 0.018 195)',
      '--brand-100': 'oklch(0.93 0.035 195)',
      '--brand-300': 'oklch(0.78 0.09 195)',
      '--brand-500': 'oklch(0.62 0.105 195)',
      '--brand-600': 'oklch(0.55 0.11 195)',
      '--brand-700': 'oklch(0.48 0.10 195)',
      '--brand-800': 'oklch(0.38 0.08 195)',
    },
  },
  indigo: {
    name: 'Trust Indigo',
    vars: {
      '--brand-50':  'oklch(0.97 0.015 265)',
      '--brand-100': 'oklch(0.93 0.035 265)',
      '--brand-300': 'oklch(0.74 0.10 265)',
      '--brand-500': 'oklch(0.55 0.13 265)',
      '--brand-600': 'oklch(0.48 0.135 265)',
      '--brand-700': 'oklch(0.42 0.13 265)',
      '--brand-800': 'oklch(0.34 0.10 265)',
    },
  },
  apothecary: {
    name: 'Warm Apothecary',
    vars: {
      '--brand-50':  'oklch(0.96 0.018 175)',
      '--brand-100': 'oklch(0.92 0.035 175)',
      '--brand-300': 'oklch(0.72 0.08 175)',
      '--brand-500': 'oklch(0.5 0.09 175)',
      '--brand-600': 'oklch(0.43 0.09 175)',
      '--brand-700': 'oklch(0.37 0.08 175)',
      '--brand-800': 'oklch(0.29 0.06 175)',
    },
  },
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'medicines', label: 'Medicines', icon: 'pill' },
  { id: 'customers', label: 'Customers', icon: 'users' },
  { id: 'reminders', label: 'Reminders', icon: 'bell' },
  { id: 'payments',  label: 'Payments',  icon: 'wallet' },
  { id: 'employees', label: 'Employees', icon: 'user', adminOnly: true },
];

const Sidebar = ({ active, navigate, role, collapsed, pending, onSignOut }) => (
  <aside className={`${collapsed ? 'w-[68px]' : 'w-[232px]'} shrink-0 border-r border-[var(--border)] bg-white flex flex-col transition-[width] duration-200`}>
    <div className={`h-[60px] border-b border-[var(--border)] flex items-center ${collapsed ? 'justify-center' : 'px-4'}`}>
      {collapsed ? <Logomark size={28}/> : <Wordmark size={28}/>}
    </div>
    <nav className="flex-1 p-2 flex flex-col gap-0.5">
      {NAV_ITEMS.filter(n => !n.adminOnly || role === 'admin').map(n => {
        const isActive = active === n.id || (n.id === 'customers' && active === 'customer');
        const showBadge = n.id === 'employees' && pending > 0;
        return (
          <button key={n.id} onClick={() => navigate(n.id)}
            className={`flex items-center gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-3'} h-9 rounded-md text-[13px] font-medium transition-colors relative
              ${isActive ? 'bg-[var(--brand-50)] text-[var(--brand-800)]' : 'text-[var(--ink-2)] hover:bg-[var(--bg-soft)]'}`}>
            <Icon name={n.icon} size={15}/>
            {!collapsed && <span className="flex-1 text-left">{n.label}</span>}
            {!collapsed && showBadge && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--danger)] text-white text-[10.5px] font-medium flex items-center justify-center">{pending}</span>}
            {collapsed && showBadge && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--danger)]"/>}
          </button>
        );
      })}
    </nav>
    <div className={`border-t border-[var(--border)] p-2 flex flex-col gap-1`}>
      <div className={`flex items-center gap-2.5 p-2 rounded-md ${collapsed ? 'justify-center' : ''}`}>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">{role === 'admin' ? 'Aditi Sharma' : 'Rohan Mehta'}</div>
            <div className="text-[11px] text-[var(--muted)] capitalize">{role}</div>
          </div>
        )}
      </div>
      <button onClick={onSignOut}
        title={collapsed ? 'Log out' : undefined}
        className={`flex items-center gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-3'} h-9 rounded-md text-[13px] font-medium text-[var(--danger-ink)] border bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] border-[color-mix(in_oklab,var(--danger)_22%,transparent)] hover:bg-[var(--danger)] hover:text-white hover:border-[var(--danger)] transition-colors`}>
        <Icon name="logout" size={14}/>
        {!collapsed && <span className="flex-1 text-left">Log out</span>}
      </button>
    </div>
  </aside>
);

const Topbar = ({ active, navigate, role, onToggleSidebar }) => (
  <div className="h-[60px] border-b border-[var(--border)] bg-white px-5 flex items-center gap-3">
    <button onClick={onToggleSidebar} className="text-[var(--muted)] hover:text-[var(--ink)] -ml-1 p-1.5 rounded hover:bg-[var(--bg-soft)]"><Icon name="menu" size={16}/></button>
    <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--muted)]">
      <span>PharmaCare</span>
      <Icon name="chevR" size={11}/>
      <span className="text-[var(--ink)] font-medium capitalize">{active === 'customer' ? 'Customer profile' : active}</span>
    </div>
    <div className="ml-auto flex items-center gap-2">
      <Badge tone={role === 'admin' ? 'brand' : 'neutral'} dot>Viewing as {role}</Badge>
    </div>
  </div>
);

// TWEAK DEFAULTS
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "teal",
  "density": "comfortable",
  "role": "admin",
  "collapsed": false
}/*EDITMODE-END*/;

const App = () => {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [signedIn, setSignedIn] = aS(true);
  const [active, setActive] = aS('dashboard');
  const [activeId, setActiveId] = aS(null);
  const [data, setData] = aS({ medicines: SEED_MEDICINES, customers: SEED_CUSTOMERS, payments: SEED_PAYMENTS, employees: SEED_EMPLOYEES });

  const navigate = (page, id) => {
    if (page === 'customer') { setActive('customer'); setActiveId(id); }
    else { setActive(page); setActiveId(null); }
    window.scrollTo(0, 0);
  };

  const pendingCount = data.employees.filter(e => !e.isApproved).length;

  // Apply theme + density vars to root
  aE(() => {
    const root = document.documentElement;
    const theme = THEMES[t.theme] || THEMES.teal;
    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty('--row-pad', t.density === 'compact' ? '8px 14px' : t.density === 'spacious' ? '16px 20px' : '12px 16px');
  }, [t.theme, t.density]);

  if (!signedIn) return (
    <ToastProvider>
      <LoginPage onLogin={() => setSignedIn(true)}/>
      <TweaksUI t={t} setTweak={setTweak}/>
    </ToastProvider>
  );

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
        <Sidebar active={active} navigate={navigate} role={t.role} collapsed={t.collapsed} pending={pendingCount} onSignOut={() => setSignedIn(false)}/>
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar active={active} navigate={navigate} role={t.role} onToggleSidebar={() => setTweak('collapsed', !t.collapsed)}/>
          <main className="flex-1 overflow-y-auto">
            <div className={`max-w-[1280px] mx-auto px-7 ${t.density === 'compact' ? 'py-5' : t.density === 'spacious' ? 'py-9' : 'py-7'}`}>
              {active === 'dashboard' && <Dashboard data={data} role={t.role} navigate={navigate}/>}
              {active === 'medicines' && <MedicineList data={data} setData={setData} role={t.role}/>}
              {active === 'customers' && <CustomerList data={data} setData={setData} role={t.role} navigate={navigate}/>}
              {active === 'customer' && <CustomerDetail data={data} setData={setData} role={t.role} customerId={activeId} navigate={navigate}/>}
              {active === 'reminders' && <Reminders data={data} setData={setData} role={t.role} navigate={navigate}/>}
              {active === 'payments' && <PaymentList data={data} setData={setData} role={t.role} navigate={navigate}/>}
              {active === 'employees' && t.role === 'admin' && <EmployeeManagement data={data} setData={setData}/>}
              {active === 'employees' && t.role !== 'admin' && (
                <EmptyState icon="lock" title="Admin only" body="Switch to admin role in Tweaks to view this page."/>
              )}
            </div>
          </main>
        </div>
      </div>
      <TweaksUI t={t} setTweak={setTweak}/>
    </ToastProvider>
  );
};

const TweaksUI = ({ t, setTweak }) => (
  <TweaksPanel>
    <TweakSection label="Theme"/>
    <TweakRadio label="Color" value={t.theme} onChange={(v) => setTweak('theme', v)}
      options={[{ value: 'teal', label: 'Teal' }, { value: 'indigo', label: 'Indigo' }, { value: 'apothecary', label: 'Apothecary' }]}/>
    <TweakSection label="View"/>
    <TweakRadio label="Role" value={t.role} onChange={(v) => setTweak('role', v)}
      options={[{ value: 'admin', label: 'Admin' }, { value: 'employee', label: 'Employee' }]}/>
    <TweakRadio label="Density" value={t.density} onChange={(v) => setTweak('density', v)}
      options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfy' }, { value: 'spacious', label: 'Spacious' }]}/>
    <TweakToggle label="Collapsed sidebar" value={t.collapsed} onChange={(v) => setTweak('collapsed', v)}/>
  </TweaksPanel>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
