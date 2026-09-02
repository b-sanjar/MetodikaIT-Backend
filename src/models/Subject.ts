import mongoose, { Document, Schema } from 'mongoose'

export interface ISubject extends Document {
  id: string
  name: string
  code: string
  description: string
  color: string
  icon: string
  order: number
}

const SubjectSchema = new Schema<ISubject>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    color: { type: String, default: 'indigo' },
    icon: { type: String, default: 'BookOpen' },
    order: { type: Number, default: 0 },
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

export const SubjectModel = mongoose.model<ISubject>('Subject', SubjectSchema)
