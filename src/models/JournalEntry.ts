import mongoose, { Document, Schema } from 'mongoose'
import type { Attendance } from '../types/index.js'

export interface IJournalEntry extends Document {
  id: string
  studentId: string
  classId: string
  date: string
  grade: number | null
  attendance: Attendance
}

const JournalEntrySchema = new Schema<IJournalEntry>(
  {
    id: { type: String, required: true, unique: true },
    studentId: { type: String, required: true, index: true },
    classId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    grade: { type: Number, default: null },
    attendance: { type: String, enum: ['keldi', 'kelmadi', 'kechikdi'], required: true, default: 'keldi' },
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

JournalEntrySchema.index({ classId: 1, studentId: 1, date: 1 }, { unique: true })

export const JournalEntryModel = mongoose.model<IJournalEntry>('JournalEntry', JournalEntrySchema)
