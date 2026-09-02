import mongoose, { Document, Schema } from 'mongoose'
import type { Role } from '../types/index.js'

export interface IUser extends Document {
  id: string
  name: string
  login: string
  passwordHash: string
  role: Role
  title: string
  photo: string
}

const UserSchema = new Schema<IUser>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    login: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'viewer'], required: true },
    title: { type: String, default: '' },
    photo: { type: String, default: '' },
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

export const UserModel = mongoose.model<IUser>('User', UserSchema)
