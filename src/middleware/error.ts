import { NextFunction, Request, Response } from 'express'

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  console.error('Server error:', err)
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Ichki server xatoligi'
  res.status(status).json({ detail: message })
}
