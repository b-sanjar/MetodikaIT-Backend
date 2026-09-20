import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { ClassGroupModel } from '../models/ClassGroup.js'
import { SubjectModel } from '../models/Subject.js'
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

// In-memory cache for resolved user sessions (45s TTL to avoid repeated DB hits on parallel requests)
interface CachedAuthUser {
  user: AuthUser
  expiresAt: number
}
const authUserCache = new Map<string, CachedAuthUser>()

export function invalidateAuthCache(userId?: string) {
  if (userId) {
    authUserCache.delete(userId)
  } else {
    authUserCache.clear()
  }
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
    const now = Date.now()
    const cached = authUserCache.get(decoded.sub)

    if (cached && cached.expiresAt > now) {
      req.user = cached.user
      return next()
    }

    if (decoded.kind === 'teacher') {
      const teacher = await TeacherModel.findOne({ id: decoded.sub })
        .select('id name login photo subjectId subjectIds classIds')
        .lean()

      if (!teacher) {
        res.status(401).json({ detail: 'Foydalanuvchi topilmadi' })
        return
      }

      const teacherSubjectIds: string[] = Array.isArray(teacher.subjectIds) && teacher.subjectIds.length
        ? teacher.subjectIds
        : teacher.subjectId
          ? [teacher.subjectId]
          : []

      const directClassIds: string[] = Array.isArray(teacher.classIds) ? teacher.classIds : []
      const [subjects, ledClasses] = await Promise.all([
        SubjectModel.find({ id: { $in: teacherSubjectIds } }).select('name').lean(),
        ClassGroupModel.find({
          $or: [{ teacherId: teacher.id }, { tutorId: teacher.id }],
        }).select('id').lean(),
      ])
      const allClassIds = [...new Set([...directClassIds, ...ledClasses.map((c) => c.id)])]
      const subjectNames = subjects.map((s) => s.name)
      const title = subjectNames.length ? `${subjectNames.join(', ')} o‘qituvchisi` : 'Fan o‘qituvchisi'

      const authUser: AuthUser = {
        id: teacher.id,
        name: teacher.name,
        login: teacher.login,
        role: 'teacher',
        title,
        photo: teacher.photo || '',
        subjectId: teacherSubjectIds[0] || null,
        subjectIds: teacherSubjectIds,
        subjectName: subjectNames.join(', '),
        subjectNames,
        classIds: allClassIds,
        kind: 'teacher',
      }

      authUserCache.set(decoded.sub, { user: authUser, expiresAt: now + 45_000 })
      req.user = authUser
    } else {
      const user = await UserModel.findOne({ id: decoded.sub })
        .select('id name login role title photo')
        .lean()

      if (!user) {
        res.status(401).json({ detail: 'Foydalanuvchi topilmadi' })
        return
      }

      const authUser: AuthUser = {
        id: user.id,
        name: user.name,
        login: user.login,
        role: user.role,
        title: user.title || (user.role === 'admin' ? 'Platforma administratori' : 'Kuzatuvchi'),
        photo: user.photo || '',
        kind: 'user',
      }

      authUserCache.set(decoded.sub, { user: authUser, expiresAt: now + 45_000 })
      req.user = authUser
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
