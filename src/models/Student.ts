import mongoose, { Document, Schema } from 'mongoose'

export interface IStudent extends Document {
  id: string
  name: string
  classId: string
  code: string
  points: number
  badges: string[]
}

export function generateStudentCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

const StudentSchema = new Schema<IStudent>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    classId: { type: String, required: true, index: true },
    code: { type: String, trim: true, sparse: true, index: true },
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

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

export function createRandomStudentCode(): string {
  const l1 = CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]
  const l2 = CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]
  const digits = Math.floor(10000 + Math.random() * 90000).toString() // 5 digits
  return `${l1}${l2}-${digits}`
}

export async function generateUniqueStudentCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = createRandomStudentCode()
    const existing = await StudentModel.findOne({
      $or: [{ code }, { code: code.replace('-', '') }],
    }).lean()
    if (!existing) return code
  }
  const l1 = CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]
  const l2 = CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]
  return `${l1}${l2}-${Date.now().toString().slice(-5)}`
}

export async function ensureStudentCodes(): Promise<void> {
  const allStudents = await StudentModel.find().select('_id code').lean()
  const codeRegex = /^[A-Z]{2}-\d{5}$/

  const needsUpgrade = allStudents.filter((s) => !s.code || !codeRegex.test(s.code))
  if (!needsUpgrade.length) return

  const existingCodes = new Set(allStudents.map((s) => s.code).filter(Boolean))
  const ops = needsUpgrade.map((s) => {
    let code = createRandomStudentCode()
    while (existingCodes.has(code)) {
      code = createRandomStudentCode()
    }
    existingCodes.add(code)
    return {
      updateOne: {
        filter: { _id: s._id },
        update: { $set: { code } },
      },
    }
  })

  await StudentModel.bulkWrite(ops)
  console.log(
    `[O‘quvchilar] ${ops.length} ta o‘quvchi kodi yangi formatga (2 ta harf + 5 ta raqam, masalan AB-12345) yangilandi.`
  )
}
