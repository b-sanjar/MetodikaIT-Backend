import { NextFunction, Request, Response, Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { PointsEventModel } from '../models/PointsEvent.js'
import { StudentModel } from '../models/Student.js'
import type { LeaderboardEntryDTO, LeaderboardPeriod } from '../types/index.js'

export const leaderboardRouter = Router()

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

// GET /api/leaderboard?period=...&classId=...&subjectId=...
leaderboardRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as LeaderboardPeriod) || 'all'
    const { classId, subjectId } = req.query

    const studentFilter: Record<string, any> = {}
    if (classId && String(classId) !== 'all') {
      studentFilter.classId = String(classId)
    }

    const students = await StudentModel.find(studentFilter)
    const studentIds = students.map((s) => s.id)

    let entries: { studentId: string; points: number }[] = []

    const hasSubjectFilter = subjectId && String(subjectId) !== 'all'
    const hasPeriodFilter = period !== 'all'

    if (!hasSubjectFilter && !hasPeriodFilter) {
      // Overall points
      entries = students.map((s) => ({
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
        eventFilter.subjectId = String(subjectId)
      }

      const events = await PointsEventModel.find(eventFilter)

      const deltasMap = new Map<string, number>()
      for (const ev of events) {
        deltasMap.set(ev.studentId, (deltasMap.get(ev.studentId) || 0) + ev.delta)
      }

      entries = students.map((s) => ({
        studentId: s.id,
        points: Math.max(0, deltasMap.get(s.id) || 0),
      }))
    }

    // Sort descending by points, then by studentId
    entries.sort((a, b) => b.points - a.points || a.studentId.localeCompare(b.studentId))

    const result: LeaderboardEntryDTO[] = entries.map((e, index) => ({
      studentId: e.studentId,
      points: e.points,
      position: index + 1,
    }))

    res.json(result)
  } catch (err) {
    next(err)
  }
})
