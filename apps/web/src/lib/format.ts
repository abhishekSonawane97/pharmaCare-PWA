export function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateShort(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function fmtTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function fmtRelative(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function daysFromToday(iso: string | Date | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = iso instanceof Date ? new Date(iso) : new Date(iso);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export function fmtINR(n: number): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function toDateInputValue(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function initials(name: string): string {
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export function dueLabel(iso: string | Date | null | undefined): { label: string; tone: 'neutral' | 'brand' | 'warning' | 'danger' } {
  const d = daysFromToday(iso);
  if (d === null) return { label: '—', tone: 'neutral' };
  if (d < 0) return { label: `${-d}d overdue`, tone: 'danger' };
  if (d === 0) return { label: 'Due today', tone: 'danger' };
  if (d === 1) return { label: 'Tomorrow', tone: 'warning' };
  if (d <= 2) return { label: `In ${d} days`, tone: 'warning' };
  if (d <= 7) return { label: `In ${d} days`, tone: 'brand' };
  return { label: `In ${d} days`, tone: 'neutral' };
}
