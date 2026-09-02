import { NextFunction, Request, Response, Router } from 'express'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { LessonModel } from '../models/Lesson.js'
import { SubjectModel } from '../models/Subject.js'
import { TeacherModel } from '../models/Teacher.js'

export const subjectsRouter = Router()

// GET /api/subjects
subjectsRouter.get('/', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const subjects = await SubjectModel.find().sort({ order: 1, name: 1 })

    // Enrich with teacher and lesson counts
    const [teachers, lessons] = await Promise.all([
      TeacherModel.find({}, 'subjectId'),
      LessonModel.find({}, 'subjectId'),
    ])

    const teacherCountMap = new Map<string, number>()
    for (const t of teachers) {
      if (t.subjectId) {
        teacherCountMap.set(t.subjectId, (teacherCountMap.get(t.subjectId) || 0) + 1)
      }
    }

    const lessonCountMap = new Map<string, number>()
    for (const l of lessons) {
      if (l.subjectId) {
        lessonCountMap.set(l.subjectId, (lessonCountMap.get(l.subjectId) || 0) + 1)
      }
    }

    const result = subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code || '',
      description: s.description || '',
      color: s.color || 'indigo',
      icon: s.icon || 'BookOpen',
      order: s.order || 0,
      teacherCount: teacherCountMap.get(s.id) || 0,
      lessonCount: lessonCountMap.get(s.id) || 0,
    }))

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// POST /api/subjects (admin only)
subjectsRouter.post('/', requireAuth, requireRoles('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, code, description, color, icon, order } = req.body || {}

    const trimmedName = String(name || '').trim()
    if (!trimmedName) {
      res.status(400).json({ detail: 'Fan nomi kiritilishi shart' })
      return
    }

    const existing = await SubjectModel.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } })
    if (existing) {
      res.status(409).json({ detail: 'Bunday fan allaqachon mavjud' })
      return
    }

    const count = await SubjectModel.countDocuments()
    const id = `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

    const subject = await SubjectModel.create({
      id,
      name: trimmedName,
      code: String(code || '').trim().toUpperCase(),
      description: String(description || '').trim(),
      color: color || 'indigo',
      icon: icon || 'BookOpen',
      order: Number(order) || count + 1,
    })

    res.status(201).json(subject)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/subjects/:id (admin only)
subjectsRouter.patch('/:id', requireAuth, requireRoles('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subject = await SubjectModel.findOne({ id: req.params.id })
    if (!subject) {
      res.status(404).json({ detail: 'Fan topilmadi' })
      return
    }

    const { name, code, description, color, icon, order } = req.body || {}

    if (name !== undefined) {
      const trimmedName = String(name).trim()
      if (!trimmedName) {
        res.status(400).json({ detail: 'Fan nomi bo‘sh bo‘lishi mumkin emas' })
        return
      }

      const duplicate = await SubjectModel.findOne({
        id: { $ne: subject.id },
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      })
      if (duplicate) {
        res.status(409).json({ detail: 'Bu nomdagi fan allaqachon mavjud' })
        return
      }
      subject.name = trimmedName
    }

    if (code !== undefined) subject.code = String(code).trim().toUpperCase()
    if (description !== undefined) subject.description = String(description).trim()
    if (color !== undefined) subject.color = String(color)
    if (icon !== undefined) subject.icon = String(icon)
    if (order !== undefined) subject.order = Number(order) || 0

    await subject.save()

    // Update denormalized subjectName in lessons
    if (name !== undefined) {
      await LessonModel.updateMany({ subjectId: subject.id }, { subjectName: subject.name })
    }

    res.json(subject)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/subjects/:id (admin only)
subjectsRouter.delete('/:id', requireAuth, requireRoles('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subject = await SubjectModel.findOne({ id: req.params.id })
    if (!subject) {
      res.status(404).json({ detail: 'Fan topilmadi' })
      return
    }

    const teachersCount = await TeacherModel.countDocuments({ subjectId: subject.id })
    if (teachersCount > 0) {
      res.status(400).json({
        detail: `Ushbu fanga ${teachersCount} nafar o‘qituvchi biriktirilgan. Avval ularni boshqa fanga o‘tkazing.`,
      })
      return
    }

    await SubjectModel.deleteOne({ id: subject.id })
    // Clear subjectId from any lessons that had this subject
    await LessonModel.updateMany({ subjectId: subject.id }, { subjectId: null, subjectName: '' })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
