import mongoose, { Document, Schema } from 'mongoose'
import type { LessonStatus } from '../types/index.js'

export interface ILesson extends Document {
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
}

const LessonSchema = new Schema<ILesson>(
  {
    id: { type: String, required: true, unique: true },
    grade: { type: Number, required: true, index: true },
    quarter: { type: Number, required: true, min: 1, max: 4 },
    order: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    objective: { type: String, default: '' },
    theory: { type: [String], default: [] },
    practice: { type: [String], default: [] },
    homework: { type: String, default: '' },
    equipment: { type: [String], default: [] },
    outcomes: { type: [String], default: [] },
    videoUrl: { type: String, default: '' },
    durationMin: { type: Number, default: 45 },
    status: { type: String, enum: ['ready', 'draft'], default: 'draft' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as any)._id
        delete (ret as any).__v
        return ret
      },
    },
  }
)

LessonSchema.index({ grade: 1, quarter: 1, order: 1 })

export const LessonModel = mongoose.model<ILesson>('Lesson', LessonSchema)
