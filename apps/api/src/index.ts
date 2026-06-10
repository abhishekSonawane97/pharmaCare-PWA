import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import authRouter from './routes/auth';
import customersRouter from './routes/customers';
import remindersRouter from './routes/reminders';
import paymentsRouter from './routes/payments';
import employeesRouter from './routes/employees';
import medicinesRouter from './routes/medicines';
import activityRouter from './routes/activity';
import settingsRouter from './routes/settings';
import dashboardRouter from './routes/dashboard';
import pushRouter from './routes/push';
import { errorHandler } from './middleware/error';
import { ensureSettings } from './models/Settings';
import {
  connectAllTenants,
  getTenantConnection,
  tenantConnectionStatus,
} from './db/connections';
import { getModels } from './db/models';
import { TENANT_IDS } from './config/tenants';
import { startDailyReminderCron } from './services/cron';
import { isPushConfigured } from './services/pushNotifications';

const PORT = parseInt(process.env.PORT || '4000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

async function main() {
  const app = express();
  app.use(cors({ origin: CORS_ORIGIN.split(','), credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(morgan('tiny'));

  app.get('/api/health', (_req, res) => {
    const tenants = tenantConnectionStatus();
    const allConnected = Object.values(tenants).every(Boolean);
    res.json({
      status: allConnected ? 'ok' : 'degraded',
      uptime: process.uptime(),
      tenants,
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/reminders', remindersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/medicines', medicinesRouter);
  app.use('/api/activity', activityRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/push', pushRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
  });

  app.use(errorHandler);

  await connectAllTenants();

  // Ensure each tenant has its Settings singleton.
  for (const t of TENANT_IDS) {
    const conn = getTenantConnection(t);
    const { Settings } = getModels(conn);
    await ensureSettings(Settings);
  }

  // Start the daily reminder push cron. The cron itself checks for VAPID
  // config on each fire, so it's safe to start regardless — it'll skip
  // dispatch (with a log line) when VAPID env vars are missing.
  if (isPushConfigured()) {
    startDailyReminderCron();
  } else {
    console.log('[push-cron] VAPID env not set — cron not scheduled. Set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY to enable push.');
  }

  app.listen(PORT, () => {
    console.log(`[api] listening on :${PORT}`);
  });
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
