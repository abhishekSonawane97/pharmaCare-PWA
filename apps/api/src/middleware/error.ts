import { ErrorRequestHandler } from 'express';
import { HttpError } from '../utils/errors';
import { ZodError } from 'zod';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    const message = err.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    res.status(400).json({ error: { code: 'validation_error', message } });
    return;
  }
  if ((err as any)?.code === 11000) {
    res.status(409).json({ error: { code: 'conflict', message: 'Duplicate value' } });
    return;
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: { code: 'internal', message: err?.message || 'Internal error' } });
};
