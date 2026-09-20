import mongoose, { Document, Schema } from 'mongoose'

export interface IJournalColumn extends Document {
  id: string
  classId: string
  date: string
  lessonId: string
}

const JournalColumnSchema = new Schema<IJournalColumn>(
  {
    id: { type: String, required: true, unique: true },
    classId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    lessonId: { type: String, required: true },
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

JournalColumnSchema.index({ classId: 1, date: 1 }, { unique: true })
JournalColumnSchema.index({ lessonId: 1 })

export const JournalColumnModel = mongoose.model<IJournalColumn>('JournalColumn', JournalColumnSchema)
