/**
 * Per-tenant Mongoose connection management.
 *
 * Each tenant has its own MongoDB cluster (separate Atlas clusters in prod), so
 * we use mongoose.createConnection() per tenant rather than the default
 * mongoose.connect() which manages a single shared connection.
 *
 * Connections are cached. The first lookup creates + caches; subsequent lookups
 * return the same Connection object. Models are registered on each connection
 * via apps/api/src/db/models.ts.
 */

import mongoose, { Connection } from 'mongoose';
import { TENANTS, TenantId, TENANT_IDS, getTenantConfig } from '../config/tenants';

const connections = new Map<TenantId, Connection>();

/**
 * Get or lazily create the Mongoose connection for a tenant.
 */
export function getTenantConnection(tenant: TenantId): Connection {
  const cached = connections.get(tenant);
  if (cached) return cached;

  const cfg = getTenantConfig(tenant);
  const conn = mongoose.createConnection(cfg.mongoUri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10_000,
  });

  conn.on('error', err => console.error(`[mongo:${tenant}] error:`, err.message));
  conn.once('connected', () => console.log(`[mongo:${tenant}] connected`));
  conn.on('disconnected', () => console.warn(`[mongo:${tenant}] disconnected`));

  connections.set(tenant, conn);
  return conn;
}

/**
 * Eagerly connect to every known tenant. Called once at API startup.
 *
 * Tenants whose Mongo URI env var is missing are logged + SKIPPED at boot —
 * the API still starts, but those tenants will reject login attempts with a
 * clear error. This lets us deploy multi-tenant code to environments that
 * haven't been onboarded for the new tenant yet (e.g. the Render fallback
 * during the rollout window).
 *
 * Tenants whose URI is configured but the cluster is unreachable will surface
 * the error in the logs; the connection retries automatically.
 */
export async function connectAllTenants(): Promise<void> {
  await Promise.all(
    TENANT_IDS.map(async t => {
      try {
        const conn = getTenantConnection(t);
        await conn.asPromise();
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes('Missing required env var')) {
          console.warn(`[mongo:${t}] SKIPPED: ${msg}. Tenant will be unavailable until env is set.`);
        } else {
          console.error(`[mongo:${t}] initial connect failed:`, msg);
        }
      }
    })
  );
}

/**
 * Health-check helper. Returns { tenantId: boolean } for /api/health.
 */
export function tenantConnectionStatus(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const t of TENANT_IDS) {
    const c = connections.get(t);
    out[t] = !!c && c.readyState === 1;
  }
  return out;
}

/**
 * Get the underlying mongoose connection without resolving tenant — only used by
 * /api/health for the legacy single-connection field. Prefer
 * tenantConnectionStatus() for new code.
 */
export function legacyDefaultConnected(): boolean {
  // The default mongoose connection is not used in multi-tenant mode. Always false.
  return mongoose.connection.readyState === 1;
}
