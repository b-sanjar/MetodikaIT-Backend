import { NextFunction, Request, Response, Router } from 'express'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { ClassGroupModel } from '../models/ClassGroup.js'
import { JournalColumnModel } from '../models/JournalColumn.js'
import { JournalEntryModel } from '../models/JournalEntry.js'
import { StudentModel } from '../models/Student.js'

export const classesRouter = Router()

// GET /api/classes
classesRouter.get('/', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const classes = await ClassGroupModel.find().sort({ grade: 1, letter: 1 })
    res.json(classes)
  } catch (err) {
    next(err)
  }
})

// POST /api/classes (admin only)
classesRouter.post('/', requireAuth, requireRoles('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { grade, letter, teacherId } = req.body || {}

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
    })

    res.status(201).json(newClass)
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

    const { grade, letter, teacherId } = req.body || {}

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

    await klass.save()
    res.json(klass)
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

    const studentsCount = await StudentModel.countDocuments({ classId: klass.id })
    if (studentsCount > 0) {
      res.status(400).json({ detail: 'Bu sinfda o‘quvchilar bor — avval ularni boshqa sinfga o‘tkazing' })
      return
    }

    // Cascade delete journal columns and entries for this class
    await JournalColumnModel.deleteMany({ classId: klass.id })
    await JournalEntryModel.deleteMany({ classId: klass.id })
    await ClassGroupModel.deleteOne({ id: klass.id })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
