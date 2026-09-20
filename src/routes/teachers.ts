import bcrypt from 'bcryptjs'
import { NextFunction, Request, Response, Router } from 'express'
import { invalidateAuthCache, requireAuth, requireRoles } from '../middleware/auth.js'
import { ClassGroupModel } from '../models/ClassGroup.js'
import { SubjectModel } from '../models/Subject.js'
import { TeacherModel } from '../models/Teacher.js'
import { UserModel } from '../models/User.js'
import type { TeacherDTO } from '../types/index.js'

export const teachersRouter = Router()

// Helper to assemble TeacherDTO with dynamic classIds and multiple subjects
async function toTeacherDTO(teacher: any): Promise<TeacherDTO> {
  const teacherSubjectIds: string[] = Array.isArray(teacher.subjectIds) && teacher.subjectIds.length
    ? teacher.subjectIds
    : teacher.subjectId
      ? [teacher.subjectId]
      : []

  const directClassIds: string[] = Array.isArray(teacher.classIds) ? teacher.classIds : []

  const [ledClasses, subjects] = await Promise.all([
    ClassGroupModel.find({
      $or: [{ teacherId: teacher.id }, { tutorId: teacher.id }],
    }).select('id').lean(),
    SubjectModel.find({ id: { $in: teacherSubjectIds } }).select('name').lean(),
  ])

  const allClassIds = [...new Set([...directClassIds, ...ledClasses.map((c) => c.id)])]
  const subjectNames = subjects.map((s) => s.name)

  return {
    id: teacher.id,
    name: teacher.name,
    phone: teacher.phone || '',
    email: teacher.email || '',
    login: teacher.login,
    photo: teacher.photo || '',
    classIds: allClassIds,
    subjectId: teacherSubjectIds[0] || null,
    subjectIds: teacherSubjectIds,
    subjectName: subjectNames.join(', '),
    subjectNames,
  }
}

// GET /api/teachers
teachersRouter.get('/', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [teachers, classes, subjects] = await Promise.all([
      TeacherModel.find().select('-passwordHash').sort({ name: 1 }).lean(),
      ClassGroupModel.find().select('id teacherId tutorId').lean(),
      SubjectModel.find().select('id name').lean(),
    ])

    const ledClassMap = new Map<string, string[]>()
    for (const c of classes) {
      if (c.teacherId) {
        const list = ledClassMap.get(c.teacherId) || []
        list.push(c.id)
        ledClassMap.set(c.teacherId, list)
      }
      if (c.tutorId) {
        const list = ledClassMap.get(c.tutorId) || []
        list.push(c.id)
        ledClassMap.set(c.tutorId, list)
      }
    }

    const subjectMap = new Map<string, string>()
    for (const s of subjects) {
      subjectMap.set(s.id, s.name)
    }

    const result: TeacherDTO[] = teachers.map((t) => {
      const teacherSubjectIds: string[] = Array.isArray(t.subjectIds) && t.subjectIds.length
        ? t.subjectIds
        : t.subjectId
          ? [t.subjectId]
          : []
      const subjectNames = teacherSubjectIds.map((sid) => subjectMap.get(sid)).filter(Boolean) as string[]

      const directClassIds: string[] = Array.isArray(t.classIds) ? t.classIds : []
      const ledClassIds = ledClassMap.get(t.id) || []
      const allClassIds = [...new Set([...directClassIds, ...ledClassIds])]

      return {
        id: t.id,
        name: t.name,
        phone: t.phone || '',
        email: t.email || '',
        login: t.login,
        photo: t.photo || '',
        classIds: allClassIds,
        subjectId: teacherSubjectIds[0] || null,
        subjectIds: teacherSubjectIds,
        subjectName: subjectNames.join(', '),
        subjectNames,
      }
    })

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
    const { name, phone, email, classIds, login, password, subjectId, subjectIds } = req.body || {}

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

    // Resolve subjectIds array
    let rawSubjectIds: string[] = []
    if (Array.isArray(subjectIds) && subjectIds.length > 0) {
      rawSubjectIds = subjectIds.map((s) => String(s).trim()).filter(Boolean)
    } else if (subjectId && typeof subjectId === 'string' && subjectId.trim()) {
      rawSubjectIds = [subjectId.trim()]
    }

    // Validate subject IDs in DB
    const validSubjects = await SubjectModel.find({ id: { $in: rawSubjectIds } })
    const validatedIds = validSubjects.map((s) => s.id)

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
      subjectId: validatedIds[0] || null,
      subjectIds: validatedIds,
      classIds: Array.isArray(classIds) ? classIds : [],
    })

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

    const { name, phone, email, classIds, login, password, subjectId, subjectIds } = req.body || {}

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

    if (subjectIds !== undefined || subjectId !== undefined) {
      let rawSubjectIds: string[] = []
      if (Array.isArray(subjectIds)) {
        rawSubjectIds = subjectIds.map((s) => String(s).trim()).filter(Boolean)
      } else if (subjectId !== undefined) {
        rawSubjectIds = subjectId ? [String(subjectId).trim()] : []
      }

      const validSubjects = await SubjectModel.find({ id: { $in: rawSubjectIds } })
      const validatedIds = validSubjects.map((s) => s.id)

      teacher.subjectIds = validatedIds
      teacher.subjectId = validatedIds[0] || null
    }

    if (Array.isArray(classIds)) {
      teacher.classIds = classIds
    }

    await teacher.save()
    invalidateAuthCache(teacher.id)

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

    invalidateAuthCache(teacher.id)

    // Set teacherId = null or tutorId = null on classes assigned to this teacher
    await ClassGroupModel.updateMany({ teacherId: teacher.id }, { teacherId: null })
    await ClassGroupModel.updateMany({ tutorId: teacher.id }, { tutorId: null })
    await TeacherModel.deleteOne({ id: teacher.id })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
