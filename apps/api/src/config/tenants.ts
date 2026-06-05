/**
 * Tenant registry — single source of truth for which pharmacies this deployment
 * serves and where each one's Mongo cluster lives.
 *
 * Static config: we expect 2-5 tenants in this deployment's lifetime. Adding a
 * new tenant means editing this file, adding a TENANT_<ID>_MONGO_URI env var,
 * and redeploying. There is no dynamic / DB-backed tenant registry.
 */

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

/**
 * Backwards-compat: while we're rolling out multi-tenant, the existing single
 * MONGO_URI env var is acceptable as the PharmaCare URI. Prefer the explicit
 * TENANT_PHARMACARE_MONGO_URI when set.
 */
function pharmacareUri(): string {
  return (
    process.env.TENANT_PHARMACARE_MONGO_URI ||
    process.env.MONGO_URI ||
    (() => { throw new Error('Missing env: set TENANT_PHARMACARE_MONGO_URI (or legacy MONGO_URI)'); })()
  );
}

export interface TenantConfig {
  id: string;
  displayName: string;
  mongoUri: string;
}

// Add new tenants here. The id is what appears in the JWT `tenant` claim AND in
// the frontend dropdown value. Keep ids ASCII, lowercase, no spaces.
export const TENANTS = {
  pharmacare: {
    id: 'pharmacare',
    displayName: 'PharmaCare',
    get mongoUri() { return pharmacareUri(); },
  },
  adilpharmacy: {
    id: 'adilpharmacy',
    displayName: 'Adil Pharmacy',
    get mongoUri() { return readEnv('TENANT_ADILPHARMACY_MONGO_URI'); },
  },
} as const satisfies Record<string, TenantConfig>;

export type TenantId = keyof typeof TENANTS;

export const TENANT_IDS = Object.keys(TENANTS) as TenantId[];

export function isTenantId(v: unknown): v is TenantId {
  return typeof v === 'string' && v in TENANTS;
}

/**
 * Resolve a tenant config or throw with a clear message. Use this anywhere you
 * have a tenant id from an untrusted source (request body, JWT claim, CLI arg).
 */
export function getTenantConfig(id: string): TenantConfig {
  if (!isTenantId(id)) {
    throw new Error(`Unknown tenant: ${id}. Known tenants: ${TENANT_IDS.join(', ')}`);
  }
  return TENANTS[id];
}
