// ui.jsx — shared primitives for PharmaCare

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── Icons (inline SVG, no external deps) ─────────────────────────────────────
const Icon = ({ name, size = 16, stroke = 1.6, className = '' }) => {
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', className };
  const paths = {
    home:       <><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></>,
    pill:       <><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></>,
    users:      <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    bell:       <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
    wallet:     <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></>,
    user:       <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    search:     <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    plus:       <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    edit:       <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></>,
    trash:      <><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>,
    chevR:      <><path d="m9 6 6 6-6 6"/></>,
    chevD:      <><path d="m6 9 6 6 6-6"/></>,
    chevL:      <><path d="m15 6-6 6 6 6"/></>,
    check:      <><path d="m5 12 5 5L20 7"/></>,
    x:          <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    whatsapp:   <><path d="M3 21l1.5-5.5A8.5 8.5 0 1 1 8.5 19.5L3 21z"/><path d="M9 9.5c.3 1.4 1.1 2.7 2.3 3.7.9.7 2 1.2 3.2 1.4.5.1 1 0 1.3-.4l.6-.7c.2-.2.5-.2.7-.1l1.5.7c.3.1.4.4.3.7-.4 1-1.5 1.7-2.7 1.6-3.5-.2-6.3-3-6.5-6.5-.1-1.2.6-2.3 1.6-2.7.3-.1.6 0 .7.3l.7 1.5c.1.2 0 .5-.1.7l-.7.6c-.4.3-.5.8-.4 1.3"/></>,
    calendar:   <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></>,
    phone:      <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></>,
    pin:        <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></>,
    note:       <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></>,
    inbox:      <><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></>,
    arrowDown:  <><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></>,
    arrowUp:    <><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></>,
    rupee:      <><path d="M6 4h12"/><path d="M6 8h12"/><path d="M6 13a5 5 0 0 0 5 5L18 8"/><path d="M6 13h7"/></>,
    menu:       <><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></>,
    logo:       <><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M3 12h18"/></>,
    sparkle:    <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2"/></>,
    eye:        <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    lock:       <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    settings:   <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>,
    logout:     <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></>,
    filter:     <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
    download:   <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></>,
    info:       <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></>,
    flask:      <><path d="M9 3h6"/><path d="M10 3v8L4 21h16l-6-10V3"/><path d="M7.5 14h9"/></>,
  };
  return <svg {...common}>{paths[name] || null}</svg>;
};

// ── Logo (original PharmaCare wordmark) ──────────────────────────────────────
const Logomark = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="PharmaCare">
    <rect x="2" y="2" width="28" height="28" rx="8" fill="var(--brand-700)"/>
    <path d="M16 8.5v15M8.5 16h15" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/>
    <circle cx="16" cy="16" r="2.6" fill="var(--brand-300)"/>
  </svg>
);

const Wordmark = ({ size = 28 }) => (
  <div className="flex items-center gap-2">
    <Logomark size={size} />
    <div className="flex flex-col leading-none">
      <span className="font-semibold tracking-tight" style={{ fontSize: size * 0.62, color: 'var(--ink)' }}>
        Pharma<span style={{ color: 'var(--brand-700)' }}>Care</span>
      </span>
      <span className="text-[10px] tracking-[0.18em] uppercase mt-0.5" style={{ color: 'var(--muted)' }}>Pharmacy OS</span>
    </div>
  </div>
);

// ── Button ───────────────────────────────────────────────────────────────────
const Button = ({ variant = 'primary', size = 'md', icon, iconRight, children, className = '', ...rest }) => {
  const sz = { sm: 'h-8 px-3 text-[12.5px]', md: 'h-9 px-3.5 text-[13px]', lg: 'h-10 px-4 text-[13.5px]' }[size];
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';
  const variants = {
    primary:   'bg-[var(--brand-700)] text-white hover:bg-[var(--brand-800)]',
    secondary: 'bg-white text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--bg-soft)]',
    ghost:     'text-[var(--ink)] hover:bg-[var(--bg-soft)]',
    danger:    'bg-[var(--danger)] text-white hover:opacity-90',
    success:   'bg-[var(--success)] text-white hover:opacity-90',
    outline:   'border border-[var(--brand-700)] text-[var(--brand-700)] hover:bg-[var(--brand-50)]',
  }[variant];
  return (
    <button className={`${base} ${sz} ${variants} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 14} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 13 : 14} />}
    </button>
  );
};

const IconButton = ({ icon, size = 14, className = '', tone = 'default', ...rest }) => {
  const tones = {
    default: 'text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]',
    danger:  'text-[var(--muted)] hover:bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] hover:text-[var(--danger)]',
    brand:   'text-[var(--muted)] hover:bg-[var(--brand-50)] hover:text-[var(--brand-700)]',
  }[tone];
  return (
    <button className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${tones} ${className}`} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
};

// ── Badge ────────────────────────────────────────────────────────────────────
const Badge = ({ tone = 'neutral', children, dot = false }) => {
  const tones = {
    neutral: 'bg-[var(--bg-soft)] text-[var(--ink-2)] border-[var(--border)]',
    brand:   'bg-[var(--brand-50)] text-[var(--brand-800)] border-[var(--brand-100)]',
    success: 'bg-[color-mix(in_oklab,var(--success)_10%,transparent)] text-[var(--success-ink)] border-[color-mix(in_oklab,var(--success)_22%,transparent)]',
    warning: 'bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] text-[var(--warning-ink)] border-[color-mix(in_oklab,var(--warning)_25%,transparent)]',
    danger:  'bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] text-[var(--danger-ink)] border-[color-mix(in_oklab,var(--danger)_22%,transparent)]',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 h-[20px] rounded-[5px] border text-[11px] font-medium tracking-tight ${tones}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80"/>}
      {children}
    </span>
  );
};

// ── Input ────────────────────────────────────────────────────────────────────
const Input = React.forwardRef(({ icon, error, className = '', ...rest }, ref) => (
  <div className="relative w-full">
    {icon && <Icon name={icon} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"/>}
    <input
      ref={ref}
      className={`w-full h-9 ${icon ? 'pl-8' : 'pl-3'} pr-3 rounded-md border bg-white text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] outline-none transition-colors
        ${error ? 'border-[var(--danger)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--danger)_22%,transparent)]'
                : 'border-[var(--border)] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-500)_22%,transparent)]'}
        ${className}`}
      {...rest}
    />
  </div>
));

const Select = ({ children, className = '', ...rest }) => (
  <div className="relative">
    <select className={`appearance-none h-9 pl-3 pr-8 rounded-md border border-[var(--border)] bg-white text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-500)_22%,transparent)] ${className}`} {...rest}>
      {children}
    </select>
    <Icon name="chevD" size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"/>
  </div>
);

const Textarea = ({ className = '', rows = 3, ...rest }) => (
  <textarea rows={rows}
    className={`w-full px-3 py-2 rounded-md border border-[var(--border)] bg-white text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-500)_22%,transparent)] resize-none ${className}`}
    {...rest}
  />
);

const Field = ({ label, hint, error, required, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
      {label}{required && <span className="text-[var(--danger)] ml-0.5">*</span>}
    </span>
    {children}
    {hint && !error && <span className="text-[11.5px] text-[var(--muted)]">{hint}</span>}
    {error && <span className="text-[11.5px] text-[var(--danger)]">{error}</span>}
  </label>
);

// ── Modal ────────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, subtitle, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size];
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-[rgba(14,27,34,0.32)] backdrop-blur-[2px]"/>
      <div className={`relative w-full ${sizes} bg-white rounded-xl border border-[var(--border)] shadow-[0_24px_60px_-20px_rgba(14,27,34,0.35)] overflow-hidden`}
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <div>
            <div className="text-[15px] font-semibold text-[var(--ink)] tracking-tight">{title}</div>
            {subtitle && <div className="text-[12.5px] text-[var(--muted)] mt-0.5">{subtitle}</div>}
          </div>
          <IconButton icon="x" onClick={onClose}/>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-soft)]">{footer}</div>}
      </div>
    </div>
  );
};

// ── Empty state ──────────────────────────────────────────────────────────────
const EmptyState = ({ icon = 'inbox', title, body, action }) => (
  <div className="flex flex-col items-center justify-center py-14 text-center">
    <div className="w-12 h-12 rounded-full bg-[var(--bg-soft)] flex items-center justify-center text-[var(--muted)] mb-3">
      <Icon name={icon} size={20}/>
    </div>
    <div className="text-[14px] font-medium text-[var(--ink)]">{title}</div>
    {body && <div className="text-[12.5px] text-[var(--muted)] mt-1 max-w-xs">{body}</div>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ── Page header ──────────────────────────────────────────────────────────────
const PageHeader = ({ title, subtitle, actions, eyebrow }) => (
  <div className="flex items-end justify-between gap-4 mb-6">
    <div>
      {eyebrow && <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1.5">{eyebrow}</div>}
      <h1 className="text-[22px] font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
      {subtitle && <p className="text-[13px] text-[var(--muted)] mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

// ── Confirm dialog ───────────────────────────────────────────────────────────
const ConfirmDialog = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger' }) => (
  <Modal open={open} onClose={onClose} title={title} size="sm"
    footer={<>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={() => { onConfirm?.(); onClose?.(); }}>{confirmLabel}</Button>
    </>}>
    <div className="text-[13px] text-[var(--ink-2)] leading-relaxed">{message}</div>
  </Modal>
);

// ── Toast ────────────────────────────────────────────────────────────────────
const ToastContext = React.createContext(null);
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, ...t }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto bg-[var(--ink)] text-white text-[12.5px] px-3.5 py-2.5 rounded-lg shadow-lg flex items-center gap-2 min-w-[220px] animate-[toast_180ms_ease-out]">
            <Icon name={t.tone === 'success' ? 'check' : t.tone === 'danger' ? 'x' : 'info'} size={14} className={t.tone === 'success' ? 'text-[var(--brand-300)]' : t.tone === 'danger' ? 'text-rose-300' : 'text-[var(--brand-300)]'}/>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
const useToast = () => React.useContext(ToastContext);

// ── Date helpers ─────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtDateShort = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};
const daysFromToday = (iso) => {
  if (!iso) return null;
  const t = new Date(); t.setHours(0,0,0,0);
  const d = new Date(iso); d.setHours(0,0,0,0);
  return Math.round((d - t) / 86400000);
};
const fmtINR = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const toDateInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

// ── WhatsApp link ────────────────────────────────────────────────────────────
const buildWhatsAppLink = (phone, customerName, medicines, dueDate) => {
  const meds = medicines.map(m => m.medicineName).join(', ');
  const msg = `Hello ${customerName}, this is a reminder from PharmaCare — your medicine refill (${meds}) is due on ${fmtDate(dueDate)}. Please visit us to collect your prescription. Thank you.`;
  return `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`;
};

const buildThankYouMessage = (customerName, medicines, nextDueDate) => {
  const meds = medicines.map(m => m.medicineName).join(', ');
  return `Hello ${customerName}, thank you for purchasing your medicines (${meds}) from PharmaCare today. Your next refill is due on ${fmtDate(nextDueDate)}. Stay healthy!`;
};

const buildThankYouLink = (phone, customerName, medicines, nextDueDate) => {
  return `https://wa.me/91${phone}?text=${encodeURIComponent(buildThankYouMessage(customerName, medicines, nextDueDate))}`;
};

// Expose to other scripts
Object.assign(window, {
  Icon, Logomark, Wordmark, Button, IconButton, Badge, Input, Select, Textarea, Field,
  Modal, EmptyState, PageHeader, ConfirmDialog, ToastProvider, useToast,
  fmtDate, fmtDateShort, daysFromToday, fmtINR, toDateInputValue, buildWhatsAppLink, buildThankYouMessage, buildThankYouLink,
});
