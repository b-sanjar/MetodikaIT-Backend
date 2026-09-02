import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { TeacherModel } from '../models/Teacher.js'
import { UserModel } from '../models/User.js'
import type { Role, SessionUser } from '../types/index.js'

export interface AuthUser extends SessionUser {
  kind: 'user' | 'teacher'
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

const JWT_SECRET = process.env.JWT_SECRET || 'metodika_it_secret_key_2026_super_secure'

export function generateToken(payload: { sub: string; kind: 'user' | 'teacher'; role: Role }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ detail: 'Token yaroqsiz' })
    return
  }

  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; kind: 'user' | 'teacher'; role: Role }
    if (decoded.kind === 'teacher') {
      const teacher = await TeacherModel.findOne({ id: decoded.sub })
      if (!teacher) {
        res.status(401).json({ detail: 'Foydalanuvchi topilmadi' })
        return
      }
      req.user = {
        id: teacher.id,
        name: teacher.name,
        login: teacher.login,
        role: 'teacher',
        title: 'IT va dasturlash o‘qituvchisi',
        photo: teacher.photo || '',
        kind: 'teacher',
      }
    } else {
      const user = await UserModel.findOne({ id: decoded.sub })
      if (!user) {
        res.status(401).json({ detail: 'Foydalanuvchi topilmadi' })
        return
      }
      req.user = {
        id: user.id,
        name: user.name,
        login: user.login,
        role: user.role,
        title: user.title || (user.role === 'admin' ? 'Platforma administratori' : 'Kuzatuvchi'),
        photo: user.photo || '',
        kind: 'user',
      }
    }
    next()
  } catch (_err) {
    res.status(401).json({ detail: 'Token yaroqsiz' })
  }
}

export function requireRoles(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ detail: 'Bu amal uchun ruxsat yo‘q' })
      return
    }
    next()
  }
}
