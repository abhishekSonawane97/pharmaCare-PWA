import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';

import authRouter from './routes/auth';
import customersRouter from './routes/customers';
import remindersRouter from './routes/reminders';
import paymentsRouter from './routes/payments';
import employeesRouter from './routes/employees';
import medicinesRouter from './routes/medicines';
import activityRouter from './routes/activity';
import settingsRouter from './routes/settings';
import dashboardRouter from './routes/dashboard';
import { errorHandler } from './middleware/error';
import { ensureSettings } from './models/Settings';

const PORT = parseInt(process.env.PORT || '4000', 10);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pharmacare';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

async function main() {
  const app = express();
  app.use(cors({ origin: CORS_ORIGIN.split(','), credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(morgan('tiny'));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      mongoConnected: mongoose.connection.readyState === 1,
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

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
  });

  app.use(errorHandler);

  await mongoose.connect(MONGO_URI);
  console.log('[mongo] connected');
  await ensureSettings();

  app.listen(PORT, () => {
    console.log(`[api] listening on :${PORT}`);
  });
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
