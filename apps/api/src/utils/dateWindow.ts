// Returns the window [now - 1d, now + 2d] used by reminders + auto-send.
// Anchored to start-of-today in server timezone.
export function reminderWindow(now: Date = new Date()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const from = new Date(startOfToday);
  from.setDate(from.getDate() - 1);
  const to = new Date(startOfToday);
  to.setDate(to.getDate() + 2);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export function startOfMonth(d: Date = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
