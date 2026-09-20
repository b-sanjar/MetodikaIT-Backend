import mongoose, { Document, Schema } from 'mongoose'

export interface IClassGroup extends Document {
  id: string
  grade: number
  letter: string
  teacherId: string | null
  tutorId: string | null
}

const ClassGroupSchema = new Schema<IClassGroup>(
  {
    id: { type: String, required: true, unique: true },
    grade: { type: Number, required: true, min: 1, max: 11 },
    letter: { type: String, required: true, trim: true, uppercase: true },
    teacherId: { type: String, default: null },
    tutorId: { type: String, default: null },
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

ClassGroupSchema.index({ grade: 1, letter: 1 }, { unique: true })
ClassGroupSchema.index({ teacherId: 1 })
ClassGroupSchema.index({ tutorId: 1 })

export const ClassGroupModel = mongoose.model<IClassGroup>('ClassGroup', ClassGroupSchema)
