import mongoose, { Document, Schema } from 'mongoose'

export interface IPointsEvent extends Document {
  id: string
  studentId: string
  date: string
  delta: number
  source: 'journal' | 'reward'
  reason: string
  badgeId: string | null
  subjectId?: string | null
  classId?: string | null
}

const PointsEventSchema = new Schema<IPointsEvent>(
  {
    id: { type: String, required: true, unique: true },
    studentId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    delta: { type: Number, required: true },
    source: { type: String, enum: ['journal', 'reward'], required: true },
    reason: { type: String, default: '' },
    badgeId: { type: String, default: null },
    subjectId: { type: String, default: null, index: true },
    classId: { type: String, default: null, index: true },
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

PointsEventSchema.index({ studentId: 1, date: -1, createdAt: -1 })

export const PointsEventModel = mongoose.model<IPointsEvent>('PointsEvent', PointsEventSchema)
