import { Request, Response, NextFunction, RequestHandler } from 'express';

export const ah =
  <P = any, ResBody = any, ReqBody = any, ReqQuery = any>(
    fn: (req: Request<P, ResBody, ReqBody, ReqQuery>, res: Response, next: NextFunction) => Promise<any>
  ): RequestHandler<P, ResBody, ReqBody, ReqQuery> =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
