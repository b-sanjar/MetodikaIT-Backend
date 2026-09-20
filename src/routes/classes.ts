import { NextFunction, Request, Response, Router } from 'express'
import { AuthRequest, requireAuth, requireRoles } from '../middleware/auth.js'
import { ClassGroupModel } from '../models/ClassGroup.js'
import { JournalColumnModel } from '../models/JournalColumn.js'
import { JournalEntryModel } from '../models/JournalEntry.js'
import { StudentModel } from '../models/Student.js'
import { TeacherModel } from '../models/Teacher.js'
import type { ClassGroupDTO } from '../types/index.js'

export const classesRouter = Router()

// GET /api/classes(?myOnly=true)
classesRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [classes, teachers] = await Promise.all([
      ClassGroupModel.find().sort({ grade: 1, letter: 1 }).lean(),
      TeacherModel.find().select('id name').lean(),
    ])

    const teacherMap = new Map<string, string>()
    for (const t of teachers) {
      teacherMap.set(t.id, t.name)
    }

    let result: ClassGroupDTO[] = classes.map((c) => ({
      id: c.id,
      grade: c.grade,
      letter: c.letter,
      teacherId: c.teacherId || null,
      tutorId: c.tutorId || null,
      teacherName: c.teacherId ? teacherMap.get(c.teacherId) || '' : '',
      tutorName: c.tutorId ? teacherMap.get(c.tutorId) || '' : '',
    }))

    // Filter for teachers if myOnly=true is requested
    if (req.query.myOnly === 'true' && req.user && req.user.role === 'teacher') {
      const userClassIds = req.user.classIds || []
      result = result.filter(
        (c) =>
          c.teacherId === req.user!.id ||
          c.tutorId === req.user!.id ||
          userClassIds.includes(c.id)
      )
    }

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// POST /api/classes (admin only)
classesRouter.post('/', requireAuth, requireRoles('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { grade, letter, teacherId, tutorId } = req.body || {}

    const parsedGrade = Number(grade)
    const upperLetter = String(letter || '').trim().toUpperCase()

    if (!parsedGrade || !upperLetter) {
      res.status(400).json({ detail: 'Sinf raqami va harfi kiritilishi shart' })
      return
    }

    const existing = await ClassGroupModel.findOne({ grade: parsedGrade, letter: upperLetter })
    if (existing) {
      res.status(409).json({ detail: 'Bunday sinf allaqachon mavjud' })
      return
    }

    const id = `c-${parsedGrade}${upperLetter.toLowerCase()}`

    const newClass = await ClassGroupModel.create({
      id,
      grade: parsedGrade,
      letter: upperLetter,
      teacherId: teacherId || null,
      tutorId: tutorId || null,
    })

    const teachers = await TeacherModel.find().select('id name').lean()
    const teacherMap = new Map(teachers.map((t) => [t.id, t.name]))

    const dto: ClassGroupDTO = {
      id: newClass.id,
      grade: newClass.grade,
      letter: newClass.letter,
      teacherId: newClass.teacherId,
      tutorId: newClass.tutorId,
      teacherName: newClass.teacherId ? teacherMap.get(newClass.teacherId) || '' : '',
      tutorName: newClass.tutorId ? teacherMap.get(newClass.tutorId) || '' : '',
    }

    res.status(201).json(dto)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/classes/:id (admin only)
classesRouter.patch('/:id', requireAuth, requireRoles('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const klass = await ClassGroupModel.findOne({ id: req.params.id })
    if (!klass) {
      res.status(404).json({ detail: 'Sinf topilmadi' })
      return
    }

    const { grade, letter, teacherId, tutorId } = req.body || {}

    const newGrade = grade !== undefined ? Number(grade) : klass.grade
    const newLetter = letter !== undefined ? String(letter).trim().toUpperCase() : klass.letter

    if (newGrade !== klass.grade || newLetter !== klass.letter) {
      const duplicate = await ClassGroupModel.findOne({
        id: { $ne: klass.id },
        grade: newGrade,
        letter: newLetter,
      })
      if (duplicate) {
        res.status(409).json({ detail: 'Bunday sinf allaqachon mavjud' })
        return
      }
    }

    klass.grade = newGrade
    klass.letter = newLetter
    if (teacherId !== undefined) {
      klass.teacherId = teacherId || null
    }
    if (tutorId !== undefined) {
      klass.tutorId = tutorId || null
    }

    await klass.save()

    const teachers = await TeacherModel.find().select('id name').lean()
    const teacherMap = new Map(teachers.map((t) => [t.id, t.name]))

    const dto: ClassGroupDTO = {
      id: klass.id,
      grade: klass.grade,
      letter: klass.letter,
      teacherId: klass.teacherId,
      tutorId: klass.tutorId,
      teacherName: klass.teacherId ? teacherMap.get(klass.teacherId) || '' : '',
      tutorName: klass.tutorId ? teacherMap.get(klass.tutorId) || '' : '',
    }

    res.json(dto)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/classes/:id (admin only)
classesRouter.delete('/:id', requireAuth, requireRoles('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const klass = await ClassGroupModel.findOne({ id: req.params.id })
    if (!klass) {
      res.status(404).json({ detail: 'Sinf topilmadi' })
      return
    }

    // Cascade delete: clean up students, journal columns, and journal entries
    await Promise.all([
      StudentModel.deleteMany({ classId: klass.id }),
      JournalColumnModel.deleteMany({ classId: klass.id }),
      JournalEntryModel.deleteMany({ classId: klass.id }),
      TeacherModel.updateMany({ classIds: klass.id }, { $pull: { classIds: klass.id } }),
      ClassGroupModel.deleteOne({ id: klass.id }),
    ])

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
