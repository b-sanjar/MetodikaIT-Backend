import { JournalEntryModel } from '../models/JournalEntry.js'
import { PointsEventModel } from '../models/PointsEvent.js'
import { IStudent, StudentModel } from '../models/Student.js'
import type { Attendance } from '../types/index.js'

export const GRADE_POINTS: Record<number, number> = {
  5: 15,
  4: 10,
  3: 5,
  2: 0,
}

export const ATTENDANCE_POINTS: Record<Attendance, number> = {
  keldi: 2,
  kechikdi: 1,
  kelmadi: 0,
}

export function cellPoints(grade: number | null | undefined, attendance: Attendance): number {
  const gPts = grade && GRADE_POINTS[grade] !== undefined ? GRADE_POINTS[grade] : 0
  const aPts = ATTENDANCE_POINTS[attendance] ?? 0
  return gPts + aPts
}

export function reasonForCell(grade: number | null | undefined, attendance: Attendance): string {
  if (grade === 5) return 'Darsda «5» baho'
  if (grade === 4) return 'Darsda «4» baho'
  if (grade === 3) return 'Darsda «3» baho'
  if (attendance === 'keldi') return 'Darsga kelgani uchun'
  if (attendance === 'kechikdi') return 'Kechikib kelgani uchun'
  return 'Dars'
}

export async function checkAutoBadges(student: IStudent, newGrade: number | null | undefined): Promise<string | null> {
  let awardedBadge: string | null = null

  // 1. Star badge: awarded on first grade 5
  if (newGrade === 5 && !student.badges.includes('star')) {
    student.badges.push('star')
    awardedBadge = 'star'
  }

  // 2. Streak badge: 5 consecutive 'keldi' lessons
  if (!student.badges.includes('streak')) {
    const entries = await JournalEntryModel.find({ studentId: student.id }).sort({ date: 1 })
    let streak = 0
    let maxStreak = 0
    for (const e of entries) {
      if (e.attendance === 'keldi') {
        streak++
        if (streak > maxStreak) maxStreak = streak
      } else {
        streak = 0
      }
    }
    if (maxStreak >= 5) {
      student.badges.push('streak')
      if (!awardedBadge) awardedBadge = 'streak'
    }
  }

  return awardedBadge
}

export async function updateJournalCellPoints(
  student: IStudent,
  date: string,
  newGrade: number | null | undefined,
  newAttendance: Attendance,
  prevGrade: number | null | undefined,
  prevAttendance: Attendance | undefined
): Promise<{ delta: number; awardedBadge: string | null }> {
  const oldPts = prevAttendance !== undefined ? cellPoints(prevGrade, prevAttendance) : 0
  const newPts = cellPoints(newGrade, newAttendance)
  const netDelta = newPts - oldPts

  student.points = Math.max(0, student.points + netDelta)

  // Check automatic badges
  const awardedBadge = await checkAutoBadges(student, newGrade)

  // Upsert PointsEvent for this journal cell
  const eventId = `pe-${student.id}-${date}`
  if (newPts > 0) {
    await PointsEventModel.findOneAndUpdate(
      { id: eventId },
      {
        id: eventId,
        studentId: student.id,
        date,
        delta: newPts,
        source: 'journal',
        reason: reasonForCell(newGrade, newAttendance),
        badgeId: awardedBadge,
      },
      { upsert: true, new: true }
    )
  } else {
    // If 0 points, remove existing journal event if any
    await PointsEventModel.deleteOne({ id: eventId })
  }

  await student.save()
  return { delta: netDelta, awardedBadge }
}
