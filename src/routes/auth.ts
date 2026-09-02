import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { AuthRequest, generateToken, requireAuth } from '../middleware/auth.js'
import { TeacherModel } from '../models/Teacher.js'
import { UserModel } from '../models/User.js'
import type { SessionUser } from '../types/index.js'

export const authRouter = Router()
export const profileRouter = Router()

// POST /api/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { login, password } = req.body || {}
    if (!login || !password) {
      res.status(401).json({ detail: 'Login yoki parol noto‘g‘ri' })
      return
    }

    const trimmedLogin = String(login).trim()

    // 1. Try Users (admin, viewer)
    const user = await UserModel.findOne({ login: trimmedLogin })
    if (user) {
      const match = await bcrypt.compare(String(password), user.passwordHash)
      if (match) {
        const token = generateToken({ sub: user.id, kind: 'user', role: user.role })
        const sessionUser: SessionUser = {
          id: user.id,
          name: user.name,
          login: user.login,
          role: user.role,
          title: user.title || (user.role === 'admin' ? 'Platforma administratori' : 'Kuzatuvchi'),
          photo: user.photo || '',
        }
        res.json({ token, user: sessionUser })
        return
      }
    }

    // 2. Try Teachers
    const teacher = await TeacherModel.findOne({ login: trimmedLogin })
    if (teacher) {
      const match = await bcrypt.compare(String(password), teacher.passwordHash)
      if (match) {
        const token = generateToken({ sub: teacher.id, kind: 'teacher', role: 'teacher' })
        const sessionUser: SessionUser = {
          id: teacher.id,
          name: teacher.name,
          login: teacher.login,
          role: 'teacher',
          title: 'Informatika o‘qituvchisi',
          photo: teacher.photo || '',
        }
        res.json({ token, user: sessionUser })
        return
      }
    }

    res.status(401).json({ detail: 'Login yoki parol noto‘g‘ri' })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json(req.user)
})

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  res.status(204).send()
})

// PATCH /api/profile
async function handleUpdateProfile(req: AuthRequest, res: any, next: any) {
  try {
    const { name, phone, email, photo, password } = req.body || {}
    const currentUser = req.user!

    if (currentUser.kind === 'teacher') {
      const teacher = await TeacherModel.findOne({ id: currentUser.id })
      if (!teacher) {
        res.status(404).json({ detail: 'Profil topilmadi' })
        return
      }

      if (name) teacher.name = String(name).trim()
      if (phone !== undefined) teacher.phone = String(phone).trim()
      if (email !== undefined) teacher.email = String(email).trim()
      if (photo !== undefined) teacher.photo = photo === 'none' ? '' : photo
      if (password && String(password).trim()) {
        teacher.passwordHash = await bcrypt.hash(String(password), 10)
      }

      await teacher.save()

      const sessionUser: SessionUser = {
        id: teacher.id,
        name: teacher.name,
        login: teacher.login,
        role: 'teacher',
        title: 'Informatika o‘qituvchisi',
        photo: teacher.photo || '',
      }
      res.json(sessionUser)
    } else {
      const user = await UserModel.findOne({ id: currentUser.id })
      if (!user) {
        res.status(404).json({ detail: 'Profil topilmadi' })
        return
      }

      if (name) user.name = String(name).trim()
      if (photo !== undefined) user.photo = photo === 'none' ? '' : photo
      if (password && String(password).trim()) {
        user.passwordHash = await bcrypt.hash(String(password), 10)
      }

      await user.save()

      const sessionUser: SessionUser = {
        id: user.id,
        name: user.name,
        login: user.login,
        role: user.role,
        title: user.title || (user.role === 'admin' ? 'Platforma administratori' : 'Kuzatuvchi'),
        photo: user.photo || '',
      }
      res.json(sessionUser)
    }
  } catch (err) {
    next(err)
  }
}

profileRouter.patch('/', requireAuth, handleUpdateProfile)
