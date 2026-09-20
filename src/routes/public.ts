import { NextFunction, Request, Response, Router } from 'express'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import { generateParentToken, JWT_SECRET } from '../middleware/auth.js'
import { ClassGroupModel } from '../models/ClassGroup.js'
import { JournalColumnModel } from '../models/JournalColumn.js'
import { JournalEntryModel } from '../models/JournalEntry.js'
import { LessonModel } from '../models/Lesson.js'
import { PointsEventModel } from '../models/PointsEvent.js'
import { StudentModel } from '../models/Student.js'
import { SubjectModel } from '../models/Subject.js'
import type {
  LeaderboardPeriod,
  PublicLeaderboardEntryDTO,
  PublicStudentDTO,
} from '../types/index.js'

export const publicRouter = Router()

// Rate limiting for general public requests: 120 req/min
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { detail: 'So‘rovlar soni me’yordan oshdi. Iltimos, birozdan so‘ng qayta urinib ko‘ring.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Strict Rate Limiting for PIN verification to prevent brute-force attacks
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 attempts per IP
  message: {
    detail: 'PIN-kod kiritish urinishlari juda ko‘payib ketdi. Xavfsizlik yuzasidan 15 daqiqadan so‘ng qayta urinib ko‘ring.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

publicRouter.use(publicLimiter)

export interface ParentRequest extends Request {
  parentSession?: {
    studentId: string
    code: string
    classId: string
  }
}

/**
 * Security Gatekeeper Middleware:
 * Ensures only parents with a valid PIN token or active PIN, or authenticated teachers/admins
 * can access parent data and leaderboard.
 */
function buildCodeQueries(input: string) {
  const raw = String(input || '').trim()
  const clean = raw.toUpperCase()
  const cleanNoDash = clean.replace(/[\s-]/g, '')
  const formattedWithDash =
    cleanNoDash.length === 7 && /^[A-Z]{2}\d{5}$/.test(cleanNoDash)
      ? `${cleanNoDash.slice(0, 2)}-${cleanNoDash.slice(2)}`
      : clean

  return [
    { code: raw },
    { code: clean },
    { code: cleanNoDash },
    { code: formattedWithDash },
    { id: raw },
  ]
}

async function requireParentOrAuth(req: ParentRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization

  // 1. Check Bearer token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any
      if (decoded.kind === 'parent') {
        req.parentSession = {
          studentId: decoded.studentId,
          code: decoded.code,
          classId: decoded.classId,
        }
        return next()
      } else if (decoded.kind === 'user' || decoded.kind === 'teacher') {
        // Teachers / admins are also permitted to view parent APIs
        return next()
      }
    } catch {
      // Invalid JWT — proceed to check code fallback
    }
  }

  // 2. Check X-Parent-Code or query code
  const codeHeader = req.headers['x-parent-code']
  const queryCode = req.query.code
  const rawCode = String(codeHeader || queryCode || '').trim()

  if (rawCode) {
    const student = await StudentModel.findOne({
      $or: buildCodeQueries(rawCode),
    })
      .select('id code classId')
      .lean()

    if (student) {
      req.parentSession = {
        studentId: student.id,
        code: student.code || student.id,
        classId: student.classId,
      }
      return next()
    }
  }

  // 3. Reject unauthorized access
  res.status(401).json({
    detail: 'Kirish taqiqlangan. Avval farzandingizning maxsus PIN-kodini kiritishingiz shart',
  })
}

function getCutoffDate(period: LeaderboardPeriod): string | null {
  const now = new Date()
  if (period === 'week') {
    now.setDate(now.getDate() - 7)
    return now.toISOString().slice(0, 10)
  }
  if (period === 'month') {
    now.setDate(now.getDate() - 30)
    return now.toISOString().slice(0, 10)
  }
  if (period === 'quarter') {
    now.setDate(now.getDate() - 90)
    return now.toISOString().slice(0, 10)
  }
  return null
}

async function buildStudentData(studentIdOrCode: string): Promise<PublicStudentDTO | null> {
  const student = await StudentModel.findOne({
    $or: buildCodeQueries(studentIdOrCode),
  }).lean()

  if (!student) return null

  const klass = await ClassGroupModel.findOne({ id: student.classId }).lean()
  const className = klass ? `${klass.grade}-«${klass.letter}»` : '—'
  const grade = klass ? klass.grade : 0
  const letter = klass ? klass.letter : ''

  // 1. Calculate ranks: School, Parallel, Class
  const [totalSchool, higherSchool] = await Promise.all([
    StudentModel.countDocuments(),
    StudentModel.countDocuments({ points: { $gt: student.points } }),
  ])
  const schoolRank = { position: higherSchool + 1, total: Math.max(1, totalSchool) }

  let parallelRank = { position: 1, total: 1 }
  if (grade > 0) {
    const parallelClasses = await ClassGroupModel.find({ grade }).select('id').lean()
    const parallelClassIds = parallelClasses.map((c) => c.id)
    const [totalParallel, higherParallel] = await Promise.all([
      StudentModel.countDocuments({ classId: { $in: parallelClassIds } }),
      StudentModel.countDocuments({
        classId: { $in: parallelClassIds },
        points: { $gt: student.points },
      }),
    ])
    parallelRank = { position: higherParallel + 1, total: Math.max(1, totalParallel) }
  }

  const [totalClass, higherClass] = await Promise.all([
    StudentModel.countDocuments({ classId: student.classId }),
    StudentModel.countDocuments({ classId: student.classId, points: { $gt: student.points } }),
  ])
  const classRank = { position: higherClass + 1, total: Math.max(1, totalClass) }

  // 2. Attendance & Grades & Recent Events
  const [entries, events, subjects, columns, lessons] = await Promise.all([
    JournalEntryModel.find({ studentId: student.id }).sort({ date: -1 }).lean(),
    PointsEventModel.find({ studentId: student.id }).sort({ date: -1, createdAt: -1 }).limit(20).lean(),
    SubjectModel.find().sort({ order: 1 }).lean(),
    JournalColumnModel.find({ classId: student.classId }).lean(),
    LessonModel.find().select('id subjectId').lean(),
  ])

  const totalLessons = entries.length
  const present = entries.filter((e) => e.attendance === 'keldi').length
  const absent = entries.filter((e) => e.attendance === 'kelmadi').length
  const late = entries.filter((e) => e.attendance === 'kechikdi').length
  const ratePercent = totalLessons > 0 ? Math.round(((present + late * 0.5) / totalLessons) * 100) : 100

  const lessonSubjectMap = new Map(lessons.map((l) => [l.id, l.subjectId || 'sub-it']))
  const columnSubjectMap = new Map(columns.map((c) => [c.date, lessonSubjectMap.get(c.lessonId) || 'sub-it']))

  const subjectGradesMap = new Map<string, number[]>()
  for (const entry of entries) {
    if (entry.grade !== null && entry.grade !== undefined) {
      const subjId = columnSubjectMap.get(entry.date) || 'sub-it'
      const list = subjectGradesMap.get(subjId) || []
      list.push(entry.grade)
      subjectGradesMap.set(subjId, list)
    }
  }

  const subjectPointsMap = new Map<string, number>()
  for (const ev of events) {
    if (ev.subjectId) {
      subjectPointsMap.set(ev.subjectId, (subjectPointsMap.get(ev.subjectId) || 0) + ev.delta)
    }
  }

  const subjectStats = subjects
    .map((sub) => {
      const grades = subjectGradesMap.get(sub.id) || []
      const sum = grades.reduce((a, b) => a + b, 0)
      const avg = grades.length > 0 ? Number((sum / grades.length).toFixed(1)) : null
      return {
        subjectId: sub.id,
        subjectName: sub.name,
        color: sub.color,
        icon: sub.icon,
        grades,
        averageGrade: avg,
        totalPoints: Math.max(0, subjectPointsMap.get(sub.id) || 0),
      }
    })
    .filter((s) => s.grades.length > 0 || s.totalPoints > 0)

  return {
    id: student.id,
    name: student.name,
    code: student.code || student.id,
    classId: student.classId,
    className,
    grade,
    letter,
    points: student.points,
    badges: student.badges || [],
    ranks: {
      school: schoolRank,
      parallel: parallelRank,
      class: classRank,
    },
    attendance: {
      totalLessons,
      present,
      absent,
      late,
      ratePercent,
    },
    subjectStats,
    recentEvents: events.map((ev) => ({
      id: ev.id,
      date: ev.date,
      delta: ev.delta,
      source: ev.source,
      reason: ev.reason,
      badgeId: ev.badgeId || null,
    })),
  }
}

// POST /api/public/verify (Rate-limited PIN verification)
publicRouter.post('/verify', pinLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawCode = String(req.body?.code || '').trim()
    if (!rawCode) {
      res.status(400).json({ detail: 'Farzandingizning maxsus PIN-kodini kiriting' })
      return
    }

    const studentData = await buildStudentData(rawCode)
    if (!studentData) {
      res.status(404).json({
        detail: 'Bunday PIN-kodli o‘quvchi topilmadi. Kodni tekshirib qayta urinib ko‘ring.',
      })
      return
    }

    const parentToken = generateParentToken({
      studentId: studentData.id,
      code: studentData.code,
      classId: studentData.classId,
    })

    res.json({
      token: parentToken,
      student: studentData,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/public/student (Protected by requireParentOrAuth)
publicRouter.get('/student', requireParentOrAuth, async (req: ParentRequest, res: Response, next: NextFunction) => {
  try {
    const targetCode = String(req.query.code || req.parentSession?.code || '').trim()
    if (!targetCode) {
      res.status(400).json({ detail: 'Farzand kodi (PIN) ko‘rsatilishi shart' })
      return
    }

    const studentData = await buildStudentData(targetCode)
    if (!studentData) {
      res.status(404).json({ detail: 'O‘quvchi topilmadi' })
      return
    }

    res.json(studentData)
  } catch (err) {
    next(err)
  }
})

// GET /api/public/meta (Protected by requireParentOrAuth)
publicRouter.get('/meta', requireParentOrAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [subjects, classes] = await Promise.all([
      SubjectModel.find().sort({ order: 1 }).lean(),
      ClassGroupModel.find().sort({ grade: 1, letter: 1 }).lean(),
    ])

    res.json({
      subjects: subjects.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        icon: s.icon,
        color: s.color,
      })),
      classes: classes.map((c) => ({
        id: c.id,
        grade: c.grade,
        letter: c.letter,
        name: `${c.grade}-«${c.letter}»`,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/public/leaderboard (Protected by requireParentOrAuth)
publicRouter.get('/leaderboard', requireParentOrAuth, async (req: ParentRequest, res: Response, next: NextFunction) => {
  try {
    const scope = String(req.query.scope || 'school')
    const period = (req.query.period as LeaderboardPeriod) || 'all'
    const subjectId = req.query.subjectId ? String(req.query.subjectId) : 'all'
    const classId = req.query.classId ? String(req.query.classId) : undefined
    const gradeParam = req.query.grade ? Number(req.query.grade) : undefined

    // 1. Build student scope filter
    const studentFilter: Record<string, any> = {}

    if (scope === 'class' && classId && classId !== 'all') {
      studentFilter.classId = classId
    } else if (scope === 'parallel') {
      let targetGrade = gradeParam
      if (!targetGrade && classId && classId !== 'all') {
        const cls = await ClassGroupModel.findOne({ id: classId }).select('grade').lean()
        if (cls) targetGrade = cls.grade
      }
      if (targetGrade) {
        const parallelClasses = await ClassGroupModel.find({ grade: targetGrade }).select('id').lean()
        studentFilter.classId = { $in: parallelClasses.map((c) => c.id) }
      }
    } else if (classId && classId !== 'all') {
      studentFilter.classId = classId
    }

    const [students, classes] = await Promise.all([
      StudentModel.find(studentFilter).select('id name code classId points').lean(),
      ClassGroupModel.find().select('id grade letter').lean(),
    ])

    const classMap = new Map(classes.map((c) => [c.id, { name: `${c.grade}-«${c.letter}»`, grade: c.grade }]))
    const studentIds = students.map((s) => s.id)

    let scores: { studentId: string; points: number }[] = []

    const hasSubjectFilter = subjectId && subjectId !== 'all'
    const hasPeriodFilter = period !== 'all'

    if (!hasSubjectFilter && !hasPeriodFilter) {
      scores = students.map((s) => ({
        studentId: s.id,
        points: s.points,
      }))
    } else {
      const eventFilter: Record<string, any> = {
        studentId: { $in: studentIds },
      }

      if (hasPeriodFilter) {
        const cutoff = getCutoffDate(period)
        if (cutoff) {
          eventFilter.date = { $gte: cutoff }
        }
      }

      if (hasSubjectFilter) {
        eventFilter.subjectId = subjectId
      }

      const aggregatedDeltas = await PointsEventModel.aggregate<{ _id: string; totalDelta: number }>([
        { $match: eventFilter },
        { $group: { _id: '$studentId', totalDelta: { $sum: '$delta' } } },
      ])

      const deltasMap = new Map<string, number>()
      for (const row of aggregatedDeltas) {
        deltasMap.set(row._id, row.totalDelta)
      }

      scores = students.map((s) => ({
        studentId: s.id,
        points: Math.max(0, deltasMap.get(s.id) || 0),
      }))
    }

    // Sort descending by points, then by name
    const studentNameMap = new Map(students.map((s) => [s.id, s.name]))
    scores.sort(
      (a, b) =>
        b.points - a.points ||
        (studentNameMap.get(a.studentId) || '').localeCompare(studentNameMap.get(b.studentId) || '')
    )

    const studentInfoMap = new Map(students.map((s) => [s.id, s]))

    // Data minimization: Clean display fields only
    const result: PublicLeaderboardEntryDTO[] = scores.map((e, index) => {
      const s = studentInfoMap.get(e.studentId)
      const c = s ? classMap.get(s.classId) : undefined
      return {
        studentId: e.studentId,
        name: s ? s.name : '—',
        code: s ? s.code || s.id : '',
        classId: s ? s.classId : '',
        className: c ? c.name : '—',
        grade: c ? c.grade : 0,
        points: e.points,
        position: index + 1,
      }
    })

    res.json(result)
  } catch (err) {
    next(err)
  }
})
