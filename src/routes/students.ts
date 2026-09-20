import { NextFunction, Request, Response, Router } from 'express'
import { AuthRequest, requireAuth, requireRoles } from '../middleware/auth.js'
import { ClassGroupModel } from '../models/ClassGroup.js'
import { JournalEntryModel } from '../models/JournalEntry.js'
import { PointsEventModel } from '../models/PointsEvent.js'
import { generateUniqueStudentCode, StudentModel } from '../models/Student.js'

export const studentsRouter = Router()

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// GET /api/students(?classId=...)
studentsRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.query
    const filter = classId ? { classId: String(classId) } : {}
    const students = await StudentModel.find(filter).sort({ name: 1 }).lean()
    res.json(students)
  } catch (err) {
    next(err)
  }
})

// POST /api/students (admin, or class teacher/tutor)
studentsRouter.post('/', requireAuth, requireRoles('admin', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, classId, points, badges } = req.body || {}

    const trimmedName = String(name || '').trim()
    if (!trimmedName || !classId) {
      res.status(400).json({ detail: 'O‘quvchi ismi va sinfi kiritilishi shart' })
      return
    }

    const klass = await ClassGroupModel.findOne({ id: String(classId) })
    if (!klass) {
      res.status(404).json({ detail: 'Bunday sinf topilmadi' })
      return
    }

    const user = (req as AuthRequest).user!
    if (user.role !== 'admin') {
      const isLeaderOrTutor = klass.teacherId === user.id || klass.tutorId === user.id
      if (!isLeaderOrTutor) {
        res.status(403).json({
          detail: 'Siz bu sinf rahbari yoki tyutori emassiz. O‘quvchi qo‘shish faqat sinf rahbari, tyutor yoki adminga ruxsat etiladi',
        })
        return
      }
    }

    const id = `s${Date.now()}`
    const parsedPoints = Math.max(0, Number(points) || 0)
    const uniqueBadges = Array.isArray(badges) ? [...new Set(badges)] : []
    const studentCode = (req.body?.code && String(req.body.code).trim()) || (await generateUniqueStudentCode())

    const student = await StudentModel.create({
      id,
      name: trimmedName,
      classId: String(classId),
      code: studentCode,
      points: parsedPoints,
      badges: uniqueBadges,
    })

    res.status(201).json(student)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/students/:id (admin, or class teacher/tutor)
studentsRouter.patch('/:id', requireAuth, requireRoles('admin', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await StudentModel.findOne({ id: req.params.id })
    if (!student) {
      res.status(404).json({ detail: 'O‘quvchi topilmadi' })
      return
    }

    const user = (req as AuthRequest).user!
    if (user.role !== 'admin') {
      const klass = await ClassGroupModel.findOne({ id: student.classId })
      const isLeaderOrTutor = klass && (klass.teacherId === user.id || klass.tutorId === user.id)
      if (!isLeaderOrTutor) {
        res.status(403).json({
          detail: 'Siz bu sinf rahbari yoki tyutori emassiz. O‘quvchini tahrirlash faqat sinf rahbari, tyutor yoki adminga ruxsat etiladi',
        })
        return
      }
    }

    const { name, classId, points, badges, code } = req.body || {}

    if (name !== undefined) student.name = String(name).trim()
    if (classId !== undefined) student.classId = String(classId)
    if (code !== undefined) {
      student.code = code === 'regenerate' ? await generateUniqueStudentCode() : String(code).trim()
    }
    if (points !== undefined) student.points = Math.max(0, Number(points))
    if (Array.isArray(badges)) student.badges = [...new Set(badges)]

    await student.save()
    res.json(student)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/students/:id (admin, or class teacher/tutor)
studentsRouter.delete('/:id', requireAuth, requireRoles('admin', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await StudentModel.findOne({ id: req.params.id })
    if (!student) {
      res.status(404).json({ detail: 'O‘quvchi topilmadi' })
      return
    }

    const user = (req as AuthRequest).user!
    if (user.role !== 'admin') {
      const klass = await ClassGroupModel.findOne({ id: student.classId })
      const isLeaderOrTutor = klass && (klass.teacherId === user.id || klass.tutorId === user.id)
      if (!isLeaderOrTutor) {
        res.status(403).json({
          detail: 'Siz bu sinf rahbari yoki tyutori emassiz. O‘quvchini o‘chirish faqat sinf rahbari, tyutor yoki adminga ruxsat etiladi',
        })
        return
      }
    }

    // Cascade delete journal entries and points history
    await JournalEntryModel.deleteMany({ studentId: student.id })
    await PointsEventModel.deleteMany({ studentId: student.id })
    await StudentModel.deleteOne({ id: student.id })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// POST /api/students/:id/points (admin, teacher)
studentsRouter.post('/:id/points', requireAuth, requireRoles('admin', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await StudentModel.findOne({ id: req.params.id })
    if (!student) {
      res.status(404).json({ detail: 'O‘quvchi topilmadi' })
      return
    }

    const { points, badgeId, reason } = req.body || {}
    const delta = Number(points) || 0

    student.points = Math.max(0, student.points + delta)

    if (badgeId && typeof badgeId === 'string' && !student.badges.includes(badgeId)) {
      student.badges.push(badgeId)
    }

    const eventId = `pe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    await PointsEventModel.create({
      id: eventId,
      studentId: student.id,
      date: todayISO(),
      delta,
      source: 'reward',
      reason: reason || (delta >= 0 ? `+${delta} ball` : `${delta} ball`),
      badgeId: badgeId || null,
    })

    await student.save()
    res.json(student)
  } catch (err) {
    next(err)
  }
})

// GET /api/students/:id/points-history?limit=20
studentsRouter.get('/:id/points-history', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const events = await PointsEventModel.find({ studentId: req.params.id })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean()

    res.json(events)
  } catch (err) {
    next(err)
  }
})

// GET /api/students/:id/journal
studentsRouter.get('/:id/journal', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = await JournalEntryModel.find({ studentId: req.params.id }).sort({ date: 1 }).lean()
    res.json(entries)
  } catch (err) {
    next(err)
  }
})
