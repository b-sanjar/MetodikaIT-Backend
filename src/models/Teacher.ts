import mongoose, { Document, Schema } from 'mongoose'

export interface ITeacher extends Document {
  id: string
  name: string
  phone: string
  email: string
  login: string
  passwordHash: string
  photo: string
  subjectId?: string | null
  subjectIds: string[]
  classIds: string[]
}

const TeacherSchema = new Schema<ITeacher>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    login: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    photo: { type: String, default: '' },
    subjectId: { type: String, default: null },
    subjectIds: { type: [String], default: [] },
    classIds: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as any)._id
        delete (ret as any).__v
        delete (ret as any).passwordHash
        return ret
      },
    },
  }
)

export const TeacherModel = mongoose.model<ITeacher>('Teacher', TeacherSchema)
