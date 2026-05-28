export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'pending'
  | 'rejected'
  | 'not_found'
  | 'validation_error'
  | 'conflict'
  | 'internal';

export class HttpError extends Error {
  status: number;
  code: ErrorCode;
  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const unauthorized = (msg = 'Unauthorized') => new HttpError(401, 'unauthorized', msg);
export const forbidden = (msg = 'Forbidden') => new HttpError(403, 'forbidden', msg);
export const notFound = (msg = 'Not found') => new HttpError(404, 'not_found', msg);
export const validationError = (msg: string) => new HttpError(400, 'validation_error', msg);
export const conflict = (msg: string) => new HttpError(409, 'conflict', msg);
