import bcrypt from 'bcryptjs'
import { NextFunction, Request, Response, Router } from 'express'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { ClassGroupModel } from '../models/ClassGroup.js'
import { TeacherModel } from '../models/Teacher.js'
import { UserModel } from '../models/User.js'
import type { TeacherDTO } from '../types/index.js'

export const teachersRouter = Router()

// Helper to assemble TeacherDTO with dynamic classIds
async function toTeacherDTO(teacher: any): Promise<TeacherDTO> {
  const classes = await ClassGroupModel.find({ teacherId: teacher.id })
  return {
    id: teacher.id,
    name: teacher.name,
    phone: teacher.phone || '',
    email: teacher.email || '',
    login: teacher.login,
    photo: teacher.photo || '',
    classIds: classes.map((c) => c.id),
  }
}

// GET /api/teachers
teachersRouter.get('/', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const teachers = await TeacherModel.find().sort({ name: 1 })
    const classes = await ClassGroupModel.find()

    const classMap = new Map<string, string[]>()
    for (const c of classes) {
      if (c.teacherId) {
        const list = classMap.get(c.teacherId) || []
        list.push(c.id)
        classMap.set(c.teacherId, list)
      }
    }

    const result: TeacherDTO[] = teachers.map((t) => ({
      id: t.id,
      name: t.name,
      phone: t.phone || '',
      email: t.email || '',
      login: t.login,
      photo: t.photo || '',
      classIds: classMap.get(t.id) || [],
    }))

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// GET /api/teachers/:id/profile
teachersRouter.get('/:id/profile', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacher = await TeacherModel.findOne({ id: req.params.id })
    if (!teacher) {
      res.status(404).json({ detail: 'O‘qituvchi topilmadi' })
      return
    }
    const dto = await toTeacherDTO(teacher)
    res.json(dto)
  } catch (err) {
    next(err)
  }
})

// POST /api/teachers (admin only)
teachersRouter.post('/', requireAuth, requireRoles('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, email, classIds, login, password } = req.body || {}

    if (!login || !String(login).trim()) {
      res.status(400).json({ detail: 'Login kiritilishi shart' })
      return
    }
    if (!password || !String(password).trim()) {
      res.status(400).json({ detail: 'Yangi o‘qituvchi uchun parol kiritilishi shart' })
      return
    }

    const trimmedLogin = String(login).trim()

    // Check login uniqueness in both Users and Teachers
    const [existingUser, existingTeacher] = await Promise.all([
      UserModel.findOne({ login: trimmedLogin }),
      TeacherModel.findOne({ login: trimmedLogin }),
    ])

    if (existingUser || existingTeacher) {
      res.status(409).json({ detail: 'Bu login band — boshqasini tanlang' })
      return
    }

    const teacherId = `t${Date.now()}`
    const passwordHash = await bcrypt.hash(String(password), 10)

    const teacher = await TeacherModel.create({
      id: teacherId,
      name: String(name || '').trim(),
      phone: String(phone || '').trim(),
      email: String(email || '').trim(),
      login: trimmedLogin,
      passwordHash,
      photo: '',
    })

    if (Array.isArray(classIds) && classIds.length > 0) {
      await ClassGroupModel.updateMany({ id: { $in: classIds } }, { teacherId })
    }

    const dto = await toTeacherDTO(teacher)
    res.status(201).json(dto)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/teachers/:id (admin only)
teachersRouter.patch('/:id', requireAuth, requireRoles('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacher = await TeacherModel.findOne({ id: req.params.id })
    if (!teacher) {
      res.status(404).json({ detail: 'O‘qituvchi topilmadi' })
      return
    }

    const { name, phone, email, classIds, login, password } = req.body || {}

    if (login && String(login).trim() !== teacher.login) {
      const trimmedLogin = String(login).trim()
      const [existingUser, existingTeacher] = await Promise.all([
        UserModel.findOne({ login: trimmedLogin }),
        TeacherModel.findOne({ login: trimmedLogin }),
      ])
      if (existingUser || existingTeacher) {
        res.status(409).json({ detail: 'Bu login band — boshqasini tanlang' })
        return
      }
      teacher.login = trimmedLogin
    }

    if (name !== undefined) teacher.name = String(name).trim()
    if (phone !== undefined) teacher.phone = String(phone).trim()
    if (email !== undefined) teacher.email = String(email).trim()
    if (password && String(password).trim()) {
      teacher.passwordHash = await bcrypt.hash(String(password), 10)
    }

    await teacher.save()

    if (Array.isArray(classIds)) {
      // Unassign classes that previously belonged to this teacher but are not in classIds
      await ClassGroupModel.updateMany(
        { teacherId: teacher.id, id: { $nin: classIds } },
        { teacherId: null }
      )
      // Assign new classes
      await ClassGroupModel.updateMany(
        { id: { $in: classIds } },
        { teacherId: teacher.id }
      )
    }

    const dto = await toTeacherDTO(teacher)
    res.json(dto)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/teachers/:id (admin only)
teachersRouter.delete('/:id', requireAuth, requireRoles('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacher = await TeacherModel.findOne({ id: req.params.id })
    if (!teacher) {
      res.status(404).json({ detail: 'O‘qituvchi topilmadi' })
      return
    }

    // Set teacherId = null on all classes assigned to this teacher
    await ClassGroupModel.updateMany({ teacherId: teacher.id }, { teacherId: null })
    await TeacherModel.deleteOne({ id: teacher.id })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
