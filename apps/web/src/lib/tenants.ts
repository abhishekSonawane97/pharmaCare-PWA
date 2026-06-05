// Frontend tenant list. Must mirror apps/api/src/config/tenants.ts.
// When you add a new tenant, also update the backend config + env vars.

export const TENANTS = [
  { id: 'pharmacare', label: 'PharmaCare' },
  { id: 'adilpharmacy', label: 'Adil Pharmacy' },
] as const;

export type TenantId = typeof TENANTS[number]['id'];

export const DEFAULT_TENANT: TenantId = 'pharmacare';

const LAST_TENANT_KEY = 'pc_last_tenant';

export function getLastTenant(): TenantId {
  if (typeof window === 'undefined') return DEFAULT_TENANT;
  const v = localStorage.getItem(LAST_TENANT_KEY);
  if (v && TENANTS.some(t => t.id === v)) return v as TenantId;
  return DEFAULT_TENANT;
}

export function rememberTenant(t: TenantId): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_TENANT_KEY, t);
}

export function tenantLabel(id: string): string {
  return TENANTS.find(t => t.id === id)?.label ?? id;
}
