import { NextFunction, Request, Response } from 'express'

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Server Error]:', err)
  const status = Number(err.status || err.statusCode) || 500
  const isProd = process.env.NODE_ENV === 'production'
  const message = isProd && status === 500 ? 'Ichki server xatoligi yuz berdi' : err.message || 'Xatolik yuz berdi'
  res.status(status).json({ detail: message })
}
