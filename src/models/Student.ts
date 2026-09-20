import mongoose, { Document, Schema } from 'mongoose'

export interface IStudent extends Document {
  id: string
  name: string
  classId: string
  points: number
  badges: string[]
}

const StudentSchema = new Schema<IStudent>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    classId: { type: String, required: true, index: true },
    points: { type: Number, default: 0, min: 0 },
    badges: { type: [String], default: [] },
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

StudentSchema.index({ classId: 1, name: 1 })
StudentSchema.index({ name: 1 })
StudentSchema.index({ points: -1 })
StudentSchema.index({ classId: 1, points: -1 })

export const StudentModel = mongoose.model<IStudent>('Student', StudentSchema)
