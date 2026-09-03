export type Role = 'admin' | 'teacher' | 'viewer'

export interface SubjectDTO {
  id: string
  name: string
  code?: string
  description?: string
  icon?: string
  color?: string
  order?: number
}

export interface SessionUser {
  id: string
  name: string
  login: string
  role: Role
  title: string
  photo: string
  subjectId?: string | null
  subjectIds?: string[]
  subjectName?: string
  subjectNames?: string[]
  classIds?: string[]
}

export interface TeacherDTO {
  id: string
  name: string
  phone: string
  email: string
  classIds: string[]
  login: string
  photo: string
  subjectId?: string | null
  subjectIds: string[]
  subjectName?: string
  subjectNames?: string[]
}

export interface ClassGroupDTO {
  id: string
  grade: number
  letter: string
  teacherId: string | null
  tutorId: string | null
  teacherName?: string
  tutorName?: string
}

export interface StudentDTO {
  id: string
  name: string
  classId: string
  points: number
  badges: string[]
}

export type LessonStatus = 'ready' | 'draft'

export interface LessonDTO {
  id: string
  grade: number
  quarter: number
  order: number
  title: string
  authorId: string
  authorName: string
  objective: string
  theory: string[]
  practice: string[]
  homework: string
  equipment: string[]
  outcomes: string[]
  videoUrl: string
  durationMin: number
  status: LessonStatus
  subjectId?: string | null
  subjectName?: string
}

export interface QuarterInfoDTO {
  grade: number
  quarter: number
  skills: string[]
}

export type Attendance = 'keldi' | 'kelmadi' | 'kechikdi'

export interface JournalColumnDTO {
  id: string
  classId: string
  date: string
  lessonId: string
}

export interface JournalEntryDTO {
  id: string
  studentId: string
  classId: string
  date: string
  grade: number | null
  attendance: Attendance
}

export interface BadgeDef {
  id: string
  name: string
  description: string
}

export interface PointsEventDTO {
  id: string
  studentId: string
  date: string
  delta: number
  source: 'journal' | 'reward'
  reason: string
  badgeId: string | null
}

export type LeaderboardPeriod = 'week' | 'month' | 'quarter' | 'all'

export interface LeaderboardEntryDTO {
  studentId: string
  points: number
  position: number
}

export interface GradeSummaryDTO {
  grade: number
  lessonCount: number
  readyCount: number
}
