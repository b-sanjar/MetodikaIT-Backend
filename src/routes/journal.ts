import { NextFunction, Request, Response, Router } from 'express'
import { AuthRequest, requireAuth, requireRoles } from '../middleware/auth.js'
import { ClassGroupModel } from '../models/ClassGroup.js'
import { JournalColumnModel } from '../models/JournalColumn.js'
import { JournalEntryModel } from '../models/JournalEntry.js'
import { LessonModel } from '../models/Lesson.js'
import { PointsEventModel } from '../models/PointsEvent.js'
import { StudentModel } from '../models/Student.js'
import { updateJournalCellPoints } from '../services/pointsService.js'
import type { Attendance } from '../types/index.js'

export const journalRouter = Router()

// GET /api/journal?classId=X
journalRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.query
    if (!classId) {
      res.status(400).json({ detail: 'Sinf (classId) ko‘rsatilishi shart' })
      return
    }

    const entries = await JournalEntryModel.find({ classId: String(classId) }).sort({ date: 1 }).lean()
    res.json(entries)
  } catch (err) {
    next(err)
  }
})

// GET /api/journal/columns?classId=X
journalRouter.get('/columns', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.query
    if (!classId) {
      res.status(400).json({ detail: 'Sinf (classId) ko‘rsatilishi shart' })
      return
    }

    const columns = await JournalColumnModel.find({ classId: String(classId) }).sort({ date: 1 }).lean()
    res.json(columns)
  } catch (err) {
    next(err)
  }
})

// POST /api/journal/columns (admin; teacher only for own class)
journalRouter.post('/columns', requireAuth, requireRoles('admin', 'teacher'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { classId, date, lessonId, quarter } = (req as any).body || {}
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
    const canTeachClass =
      user.role === 'admin' ||
      klass.teacherId === user.id ||
      klass.tutorId === user.id ||
      (user.classIds || []).includes(klass.id)

    if (!canTeachClass) {
      res.status(403).json({ detail: 'Bu sinfda dars o‘tish va baholash huquqingiz yo‘q' })
      return
    }

    const existing = await JournalColumnModel.findOne({ classId: klass.id, date: String(date) })
    if (existing) {
      res.status(409).json({ detail: 'Bu sana uchun dars allaqachon ochilgan' })
      return
    }

    // Resolve subjectId, quarter, and lessonType from the lesson
    const lesson = await LessonModel.findOne({ id: String(lessonId) }).select('subjectId quarter lessonType').lean()
    const subjectId = lesson?.subjectId || null
    const resolvedQuarter = quarter ? Number(quarter) : (lesson?.quarter || 1)
    const resolvedLessonType = lesson?.lessonType || 'standard'

    const id = `jc-${klass.id}-${date}`
    const column = await JournalColumnModel.create({
      id,
      classId: klass.id,
      date: String(date),
      lessonId: String(lessonId),
      quarter: resolvedQuarter,
      lessonType: resolvedLessonType,
    })

    // Initialize all students of this class as 'keldi' with +2 attendance points
    const students = await StudentModel.find({ classId: klass.id })
    const createdEntries: any[] = []

    for (const st of students) {
      await updateJournalCellPoints(
        st,
        String(date),
        null,
        'keldi',
        undefined,
        undefined,
        subjectId,
        klass.id
      )

      const entryId = `j-${st.id}-${date}`
      const entry = await JournalEntryModel.findOneAndUpdate(
        { classId: klass.id, studentId: st.id, date: String(date) },
        {
          id: entryId,
          classId: klass.id,
          studentId: st.id,
          date: String(date),
          grade: null,
          attendance: 'keldi',
          needsWork: false,
          note: '',
        },
        { upsert: true, new: true }
      )
      createdEntries.push(entry)
    }

    res.status(201).json({
      ...column.toJSON(),
      entries: createdEntries,
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/journal/columns/:id (admin, teacher) — cancels/deletes a conducted lesson column
journalRouter.delete('/columns/:id', requireAuth, requireRoles('admin', 'teacher'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const columnId = req.params.id
    const column = await JournalColumnModel.findOne({ id: columnId })
    if (!column) {
      res.status(404).json({ detail: 'Jurnal darsi topilmadi' })
      return
    }

    const klass = await ClassGroupModel.findOne({ id: column.classId })
    const user = req.user!
    const canTeachClass =
      user.role === 'admin' ||
      (klass && (klass.teacherId === user.id || klass.tutorId === user.id || (user.classIds || []).includes(klass.id)))

    if (!canTeachClass) {
      res.status(403).json({ detail: 'Bu sinfdagi darsni bekor qilish huquqingiz yo‘q' })
      return
    }

    // Delete associated entries and points events
    await Promise.all([
      JournalEntryModel.deleteMany({ classId: column.classId, date: column.date }),
      PointsEventModel.deleteMany({ classId: column.classId, date: column.date }),
      JournalColumnModel.deleteOne({ id: column.id }),
    ])

    res.json({ message: 'Dars muvaffaqiyatli bekor qilindi', id: column.id })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/journal/columns/:id (admin, teacher) — edits column lessonId or date
journalRouter.patch('/columns/:id', requireAuth, requireRoles('admin', 'teacher'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const columnId = req.params.id
    const column = await JournalColumnModel.findOne({ id: columnId })
    if (!column) {
      res.status(404).json({ detail: 'Jurnal darsi topilmadi' })
      return
    }

    const klass = await ClassGroupModel.findOne({ id: column.classId })
    const user = req.user!
    const canTeachClass =
      user.role === 'admin' ||
      (klass && (klass.teacherId === user.id || klass.tutorId === user.id || (user.classIds || []).includes(klass.id)))

    if (!canTeachClass) {
      res.status(403).json({ detail: 'Bu darsni tahrirlash huquqingiz yo‘q' })
      return
    }

    const { lessonId, date, quarter, lessonType } = req.body || {}
    if (lessonId) {
      column.lessonId = String(lessonId)
      const lesson = await LessonModel.findOne({ id: String(lessonId) }).select('quarter lessonType').lean()
      if (lesson) {
        column.quarter = lesson.quarter
        column.lessonType = lesson.lessonType || 'standard'
      }
    }
    if (date) {
      column.date = String(date)
    }
    if (quarter) {
      column.quarter = Number(quarter)
    }
    if (lessonType) {
      column.lessonType = String(lessonType)
    }

    await column.save()
    res.json(column)
  } catch (err) {
    next(err)
  }
})

// PUT /api/journal/cell (admin, class teacher, tutor, or assigned subject teacher) — upsert
journalRouter.put('/cell', requireAuth, requireRoles('admin', 'teacher'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { classId, studentId, date, grade, attendance, needsWork, note } = (req as any).body || {}

    if (!classId || !studentId || !date) {
      res.status(400).json({ detail: 'Sinf, o‘quvchi va sana ko‘rsatilishi shart' })
      return
    }

    // Parallelize lookups for class, student, existing entry, and column
    const [klass, student, existing, column] = await Promise.all([
      ClassGroupModel.findOne({ id: String(classId) }),
      StudentModel.findOne({ id: String(studentId) }),
      JournalEntryModel.findOne({
        classId: String(classId),
        studentId: String(studentId),
        date: String(date),
      }),
      JournalColumnModel.findOne({ classId: String(classId), date: String(date) }).lean(),
    ])

    if (!klass) {
      res.status(404).json({ detail: 'Sinf topilmadi' })
      return
    }

    const user = req.user!
    const canTeachClass =
      user.role === 'admin' ||
      klass.teacherId === user.id ||
      klass.tutorId === user.id ||
      (user.classIds || []).includes(klass.id)

    if (!canTeachClass) {
      res.status(403).json({ detail: 'Bu sinfda dars o‘tish va baholash huquqingiz yo‘q' })
      return
    }

    if (!student) {
      res.status(404).json({ detail: 'O‘quvchi topilmadi' })
      return
    }

    const targetAttendance: Attendance = attendance || existing?.attendance || 'keldi'
    let targetGrade: number | null = null

    if (targetAttendance === 'kelmadi' || targetAttendance === 'sababli' || targetAttendance === 'sababsiz') {
      targetGrade = null
    } else if (grade !== undefined) {
      targetGrade = grade === null ? null : Number(grade)
    } else {
      targetGrade = existing?.grade ?? null
    }

    const targetNeedsWork = needsWork !== undefined ? Boolean(needsWork) : (existing?.needsWork ?? false)
    const targetNote = note !== undefined ? String(note).trim() : (existing?.note ?? '')

    // Resolve subjectId from the lesson conducted on this date
    let subjectId: string | null = null
    if (column) {
      const lesson = await LessonModel.findOne({ id: column.lessonId }).select('subjectId').lean()
      subjectId = lesson?.subjectId || null
    }

    // Recalculate points delta, update student, check auto-badges, log points event with subjectId
    await updateJournalCellPoints(
      student,
      String(date),
      targetGrade,
      targetAttendance,
      existing?.grade,
      existing?.attendance,
      subjectId,
      klass.id
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
        needsWork: targetNeedsWork,
        note: targetNote,
      },
      { upsert: true, new: true }
    )

    res.json({ entry, student })
  } catch (err) {
    next(err)
  }
})
