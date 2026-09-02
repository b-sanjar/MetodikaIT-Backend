import mongoose, { Document, Schema } from 'mongoose'

export interface IQuarterInfo extends Document {
  grade: number
  quarter: number
  skills: string[]
}

const QuarterInfoSchema = new Schema<IQuarterInfo>(
  {
    grade: { type: Number, required: true },
    quarter: { type: Number, required: true, min: 1, max: 4 },
    skills: { type: [String], default: [] },
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

QuarterInfoSchema.index({ grade: 1, quarter: 1 }, { unique: true })

export const QuarterInfoModel = mongoose.model<IQuarterInfo>('QuarterInfo', QuarterInfoSchema)
