import { NextFunction, Request, Response, Router } from 'express'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { JournalEntryModel } from '../models/JournalEntry.js'
import { PointsEventModel } from '../models/PointsEvent.js'
import { StudentModel } from '../models/Student.js'

export const studentsRouter = Router()

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// GET /api/students(?classId=...)
studentsRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.query
    const filter = classId ? { classId: String(classId) } : {}
    const students = await StudentModel.find(filter).sort({ name: 1 })
    res.json(students)
  } catch (err) {
    next(err)
  }
})

// POST /api/students (admin, teacher)
studentsRouter.post('/', requireAuth, requireRoles('admin', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, classId, points, badges } = req.body || {}

    const trimmedName = String(name || '').trim()
    if (!trimmedName || !classId) {
      res.status(400).json({ detail: 'O‘quvchi ismi va sinfi kiritilishi shart' })
      return
    }

    const id = `s${Date.now()}`
    const parsedPoints = Math.max(0, Number(points) || 0)
    const uniqueBadges = Array.isArray(badges) ? [...new Set(badges)] : []

    const student = await StudentModel.create({
      id,
      name: trimmedName,
      classId: String(classId),
      points: parsedPoints,
      badges: uniqueBadges,
    })

    res.status(201).json(student)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/students/:id (admin, teacher)
studentsRouter.patch('/:id', requireAuth, requireRoles('admin', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await StudentModel.findOne({ id: req.params.id })
    if (!student) {
      res.status(404).json({ detail: 'O‘quvchi topilmadi' })
      return
    }

    const { name, classId, points, badges } = req.body || {}

    if (name !== undefined) student.name = String(name).trim()
    if (classId !== undefined) student.classId = String(classId)
    if (points !== undefined) student.points = Math.max(0, Number(points))
    if (Array.isArray(badges)) student.badges = [...new Set(badges)]

    await student.save()
    res.json(student)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/students/:id (admin, teacher)
studentsRouter.delete('/:id', requireAuth, requireRoles('admin', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await StudentModel.findOne({ id: req.params.id })
    if (!student) {
      res.status(404).json({ detail: 'O‘quvchi topilmadi' })
      return
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

    res.json(events)
  } catch (err) {
    next(err)
  }
})

// GET /api/students/:id/journal
studentsRouter.get('/:id/journal', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = await JournalEntryModel.find({ studentId: req.params.id }).sort({ date: 1 })
    res.json(entries)
  } catch (err) {
    next(err)
  }
})
