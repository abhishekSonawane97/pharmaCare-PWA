export function normalizePhone(input: string | undefined | null): string {
  if (!input) return '';
  const trimmed = String(input).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/\D/g, '');
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return '+91' + digits;
  if (digits.length > 10) return '+' + digits;
  return digits;
}

export function formatDateForWA(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
