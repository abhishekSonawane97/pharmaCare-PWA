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
 * Surfaces bad URIs or unreachable clusters at boot rather than per-request.
 * If any tenant fails to connect, the API exits (let the orchestrator restart).
 */
export async function connectAllTenants(): Promise<void> {
  await Promise.all(
    TENANT_IDS.map(async t => {
      const conn = getTenantConnection(t);
      await conn.asPromise();
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
