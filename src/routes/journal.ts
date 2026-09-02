import { Router } from 'express'
import { AuthRequest, requireAuth, requireRoles } from '../middleware/auth.js'
import { ClassGroupModel } from '../models/ClassGroup.js'
import { JournalColumnModel } from '../models/JournalColumn.js'
import { JournalEntryModel } from '../models/JournalEntry.js'
import { StudentModel } from '../models/Student.js'
import { updateJournalCellPoints } from '../services/pointsService.js'
import type { Attendance } from '../types/index.js'

export const journalRouter = Router()

// GET /api/journal?classId=X
journalRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { classId } = req.query
    if (!classId) {
      res.status(400).json({ detail: 'Sinf (classId) ko‘rsatilishi shart' })
      return
    }

    const entries = await JournalEntryModel.find({ classId: String(classId) }).sort({ date: 1 })
    res.json(entries)
  } catch (err) {
    next(err)
  }
})

// GET /api/journal/columns?classId=X
journalRouter.get('/columns', requireAuth, async (req, res, next) => {
  try {
    const { classId } = req.query
    if (!classId) {
      res.status(400).json({ detail: 'Sinf (classId) ko‘rsatilishi shart' })
      return
    }

    const columns = await JournalColumnModel.find({ classId: String(classId) }).sort({ date: 1 })
    res.json(columns)
  } catch (err) {
    next(err)
  }
})

// POST /api/journal/columns (admin; teacher only for own class)
journalRouter.post('/columns', requireAuth, requireRoles('admin', 'teacher'), async (req: AuthRequest, res, next) => {
  try {
    const { classId, date, lessonId } = req.body || {}
    if (!classId || !date || !lessonId) {
      res.status(400).json({ detail: 'Sinf, sana va dars tanlanishi shart' })
      return
    }

    const klass = await ClassGroupModel.findOne({ id: String(classId) })
    if (!klass) {
      res.status(404).json({ detail: 'Sinf topilmadi' })
      return
    }

    const user = req.user!
    if (user.role !== 'admin' && klass.teacherId !== user.id) {
      res.status(403).json({ detail: 'Bu sinfda baholash huquqingiz yo‘q' })
      return
    }

    const existing = await JournalColumnModel.findOne({ classId: klass.id, date: String(date) })
    if (existing) {
      res.status(409).json({ detail: 'Bu sana uchun dars allaqachon ochilgan' })
      return
    }

    const id = `jc-${klass.id}-${date}`
    const column = await JournalColumnModel.create({
      id,
      classId: klass.id,
      date: String(date),
      lessonId: String(lessonId),
    })

    res.status(201).json(column)
  } catch (err) {
    next(err)
  }
})

// PUT /api/journal/cell (admin; teacher only for own class) — upsert
journalRouter.put('/cell', requireAuth, requireRoles('admin', 'teacher'), async (req: AuthRequest, res, next) => {
  try {
    const { classId, studentId, date, grade, attendance } = req.body || {}

    if (!classId || !studentId || !date) {
      res.status(400).json({ detail: 'Sinf, o‘quvchi va sana ko‘rsatilishi shart' })
      return
    }

    const klass = await ClassGroupModel.findOne({ id: String(classId) })
    if (!klass) {
      res.status(404).json({ detail: 'Sinf topilmadi' })
      return
    }

    const user = req.user!
    if (user.role !== 'admin' && klass.teacherId !== user.id) {
      res.status(403).json({ detail: 'Bu sinfda baholash huquqingiz yo‘q' })
      return
    }

    const student = await StudentModel.findOne({ id: String(studentId) })
    if (!student) {
      res.status(404).json({ detail: 'O‘quvchi topilmadi' })
      return
    }

    const existing = await JournalEntryModel.findOne({
      classId: klass.id,
      studentId: student.id,
      date: String(date),
    })

    const targetAttendance: Attendance = attendance || existing?.attendance || 'keldi'
    let targetGrade: number | null = null

    if (targetAttendance === 'kelmadi') {
      targetGrade = null
    } else if (grade !== undefined) {
      targetGrade = grade === null ? null : Number(grade)
    } else {
      targetGrade = existing?.grade ?? null
    }

    // Recalculate points delta, update student, check auto-badges, log points event
    await updateJournalCellPoints(
      student,
      String(date),
      targetGrade,
      targetAttendance,
      existing?.grade,
      existing?.attendance
    )

    const entryId = existing?.id || `j-${student.id}-${date}`
    const entry = await JournalEntryModel.findOneAndUpdate(
      { classId: klass.id, studentId: student.id, date: String(date) },
      {
        id: entryId,
        classId: klass.id,
        studentId: student.id,
        date: String(date),
        grade: targetGrade,
        attendance: targetAttendance,
      },
      { upsert: true, new: true }
    )

    res.json({ entry, student })
  } catch (err) {
    next(err)
  }
})
