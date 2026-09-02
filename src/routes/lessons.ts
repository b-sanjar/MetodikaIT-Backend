import { NextFunction, Request, Response, Router } from 'express'
import { AuthRequest, requireAuth, requireRoles } from '../middleware/auth.js'
import { JournalColumnModel } from '../models/JournalColumn.js'
import { LessonModel } from '../models/Lesson.js'
import {
  EQUIPMENT_BASE,
  homeworkFor,
  objectiveFor,
  outcomesFor,
  practiceFor,
  theoryFor,
} from '../services/lessonTemplate.js'
import type { GradeSummaryDTO } from '../types/index.js'

export const lessonsRouter = Router()

// GET /api/lessons/summary
lessonsRouter.get('/summary', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summaries: GradeSummaryDTO[] = []
    const allLessons = await LessonModel.find({}, 'grade status')

    for (let grade = 1; grade <= 11; grade++) {
      const gradeLessons = allLessons.filter((l) => l.grade === grade)
      summaries.push({
        grade,
        lessonCount: gradeLessons.length,
        readyCount: gradeLessons.filter((l) => l.status === 'ready').length,
      })
    }

    res.json(summaries)
  } catch (err) {
    next(err)
  }
})

// GET /api/lessons?grade=X
lessonsRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { grade } = req.query
    if (!grade) {
      res.status(400).json({ detail: 'Sinf (grade) ko‘rsatilishi shart' })
      return
    }

    const lessons = await LessonModel.find({ grade: Number(grade) }).sort({
      quarter: 1,
      order: 1,
    })
    res.json(lessons)
  } catch (err) {
    next(err)
  }
})

// GET /api/lessons/:id
lessonsRouter.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lesson = await LessonModel.findOne({ id: req.params.id })
    if (!lesson) {
      res.status(404).json({ detail: 'Dars topilmadi' })
      return
    }
    res.json(lesson)
  } catch (err) {
    next(err)
  }
})

// POST /api/lessons (admin, teacher)
lessonsRouter.post('/', requireAuth, requireRoles('admin', 'teacher'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { grade, quarter, title, durationMin } = (req as any).body || {}

    const parsedGrade = Number(grade)
    const parsedQuarter = Number(quarter)
    const trimmedTitle = String(title || '').trim()

    if (!parsedGrade || !parsedQuarter || !trimmedTitle) {
      res.status(400).json({ detail: 'Sinf, chorak va dars mavzusi to‘ldirilishi shart' })
      return
    }

    // Find next order in same grade & quarter
    const lastLesson = await LessonModel.findOne({ grade: parsedGrade, quarter: parsedQuarter }).sort({ order: -1 })
    const nextOrder = lastLesson ? lastLesson.order + 1 : 1

    const id = `l-${parsedGrade}-${parsedQuarter}-${nextOrder}-${Date.now().toString(36)}`

    const newLesson = await LessonModel.create({
      id,
      grade: parsedGrade,
      quarter: parsedQuarter,
      order: nextOrder,
      title: trimmedTitle,
      authorId: req.user!.id,
      authorName: req.user!.name,
      objective: objectiveFor(trimmedTitle, parsedGrade),
      theory: theoryFor(trimmedTitle),
      practice: practiceFor(trimmedTitle),
      homework: homeworkFor(trimmedTitle),
      equipment: EQUIPMENT_BASE,
      outcomes: outcomesFor(trimmedTitle),
      videoUrl: '',
      durationMin: Number(durationMin) || 45,
      status: 'draft',
    })

    res.status(201).json(newLesson)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/lessons/:id (admin, teacher)
lessonsRouter.patch('/:id', requireAuth, requireRoles('admin', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lesson = await LessonModel.findOne({ id: req.params.id })
    if (!lesson) {
      res.status(404).json({ detail: 'Dars topilmadi' })
      return
    }

    const {
      title,
      objective,
      theory,
      practice,
      homework,
      equipment,
      outcomes,
      durationMin,
      status,
      videoUrl,
    } = req.body || {}

    if (title !== undefined) lesson.title = String(title).trim()
    if (objective !== undefined) lesson.objective = String(objective)
    if (Array.isArray(theory)) lesson.theory = theory
    if (Array.isArray(practice)) lesson.practice = practice
    if (homework !== undefined) lesson.homework = String(homework)
    if (Array.isArray(equipment)) lesson.equipment = equipment
    if (Array.isArray(outcomes)) lesson.outcomes = outcomes
    if (durationMin !== undefined) lesson.durationMin = Number(durationMin) || 45
    if (status !== undefined && (status === 'ready' || status === 'draft')) lesson.status = status
    if (videoUrl !== undefined) lesson.videoUrl = String(videoUrl)

    await lesson.save()
    res.json(lesson)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/lessons/:id (admin or author)
lessonsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const lessonId = (req as any).params?.id
    const lesson = await LessonModel.findOne({ id: lessonId })
    if (!lesson) {
      res.status(404).json({ detail: 'Dars topilmadi' })
      return
    }

    const isAuthorized = req.user!.role === 'admin' || lesson.authorId === req.user!.id
    if (!isAuthorized) {
      res.status(403).json({ detail: 'Bu darsni faqat admin yoki uni yaratgan o‘qituvchi o‘chira oladi' })
      return
    }

    // Check if bound to journal column
    const columnCount = await JournalColumnModel.countDocuments({ lessonId: lesson.id })
    if (columnCount > 0) {
      res.status(400).json({
        detail: 'Bu dars jurnalda o‘tilgan darslarga biriktirilgan — avval jurnalni tekshiring',
      })
      return
    }

    await LessonModel.deleteOne({ id: lesson.id })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
