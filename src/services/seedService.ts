import bcrypt from 'bcryptjs'
import { ClassGroupModel } from '../models/ClassGroup.js'
import { JournalColumnModel } from '../models/JournalColumn.js'
import { JournalEntryModel } from '../models/JournalEntry.js'
import { LessonModel } from '../models/Lesson.js'
import { PointsEventModel } from '../models/PointsEvent.js'
import { QuarterInfoModel } from '../models/QuarterInfo.js'
import { ensureStudentCodes, StudentModel } from '../models/Student.js'
import { SubjectModel } from '../models/Subject.js'
import { TeacherModel } from '../models/Teacher.js'
import { UserModel } from '../models/User.js'

export const DEFAULT_SUBJECTS = [
  {
    id: 'sub-it',
    name: 'IT va dasturlash',
    code: 'IT',
    color: 'indigo',
    icon: 'Code',
    description: 'Dasturlash asoslari, kompyuter savodxonligi va axborot texnologiyalari',
    order: 1,
  },
  {
    id: 'sub-math',
    name: 'Matematika',
    code: 'MATH',
    color: 'emerald',
    icon: 'Calculator',
    description: 'Algebra, geometriya va mantiqiy hisoblash ko‘nikmalari',
    order: 2,
  },
  {
    id: 'sub-phys',
    name: 'Fizika',
    code: 'FIZ',
    color: 'sky',
    icon: 'Atom',
    description: 'Tabiat qonunlari, mexanika, optika va elektronika',
    order: 3,
  },
  {
    id: 'sub-native',
    name: 'Ona tili va adabiyot',
    code: 'TIL',
    color: 'amber',
    icon: 'BookOpen',
    description: 'Grammatika, adabiy meros, imlo va nutq madaniyati',
    order: 4,
  },
  {
    id: 'sub-eng',
    name: 'Ingliz tili',
    code: 'ENG',
    color: 'blue',
    icon: 'Languages',
    description: 'Xorijiy til ko‘nikmalari, grammatika va xalqaro muloqot',
    order: 5,
  },
  {
    id: 'sub-chem',
    name: 'Kimyo',
    code: 'KIM',
    color: 'rose',
    icon: 'FlaskConical',
    description: 'Moddalar tuzilishi, kimyoviy reaksiyalar va laboratoriya mashg‘ulotlari',
    order: 6,
  },
  {
    id: 'sub-bio',
    name: 'Biologiya',
    code: 'BIO',
    color: 'teal',
    icon: 'Dna',
    description: 'Tirik tabiat, inson anatomiyasi, botanika va ekologiya',
    order: 7,
  },
  {
    id: 'sub-hist',
    name: 'Tarix',
    code: 'TAR',
    color: 'orange',
    icon: 'Landmark',
    description: 'O‘zbekiston va jahon sivilizatsiyalari tarixi',
    order: 8,
  },
]

export async function ensureDefaultSubjects(): Promise<void> {
  const count = await SubjectModel.estimatedDocumentCount()
  if (count === 0) {
    console.log('[Fanlar] Boshlang‘ich maktab fanlari kiritilmoqda...')
    await SubjectModel.insertMany(DEFAULT_SUBJECTS)
    console.log(`[Fanlar] ${DEFAULT_SUBJECTS.length} ta fan muvaffaqiyatli saqlandi!`)
  }
}

export async function ensureAdminUser(): Promise<void> {
  const adminLogin = process.env.ADMIN_LOGIN || 'burxonovsanjar21@gmail.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'AXL007_c3'
  const adminName = process.env.ADMIN_NAME || 'Sanjar Burxonov'

  const admin = await UserModel.findOne({ login: adminLogin })
  if (!admin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10)
    await UserModel.deleteMany({ login: { $ne: adminLogin } })
    await UserModel.create({
      id: 'u-admin',
      name: adminName,
      login: adminLogin,
      passwordHash,
      role: 'admin',
      title: 'Platforma administratori',
      photo: '',
    })
    console.log(`[Admin] Yangi admin yaratildi: ${adminName} (${adminLogin})`)
  } else {
    const isPasswordMatch = await bcrypt.compare(adminPassword, admin.passwordHash)
    if (!isPasswordMatch || admin.name !== adminName || admin.role !== 'admin') {
      admin.name = adminName
      admin.passwordHash = isPasswordMatch ? admin.passwordHash : await bcrypt.hash(adminPassword, 10)
      admin.role = 'admin'
      admin.title = 'Platforma administratori'
      await admin.save()
      console.log(`[Admin] Admin hisobi yangilandi: ${adminName} (${adminLogin})`)
    }
  }
}

/**
 * Completely clean all data from the database (lessons, classes, teachers, students, journals)
 * and ensure ONLY the primary admin user and default subjects exist.
 */
export async function cleanEverything(): Promise<void> {
  console.log('[Tozalash] Barcha darslar, sinflar, o‘qituvchilar va o‘quvchilar tozalanmoqda...')

  const [delLessons, delQuarters, delStudents, delTeachers, delClasses, delCols, delEntries, delEvents] =
    await Promise.all([
      LessonModel.deleteMany({}),
      QuarterInfoModel.deleteMany({}),
      StudentModel.deleteMany({}),
      TeacherModel.deleteMany({}),
      ClassGroupModel.deleteMany({}),
      JournalColumnModel.deleteMany({}),
      JournalEntryModel.deleteMany({}),
      PointsEventModel.deleteMany({}),
    ])

  console.log(`[Tozalash Natijalari]:
  - O‘chirilgan mavzular (darslar): ${delLessons.deletedCount}
  - O‘chirilgan choraklar ko‘nikmalari: ${delQuarters.deletedCount}
  - O‘chirilgan o‘quvchilar: ${delStudents.deletedCount}
  - O‘chirilgan o‘qituvchilar: ${delTeachers.deletedCount}
  - O‘chirilgan sinflar: ${delClasses.deletedCount}
  - O‘chirilgan jurnal ustunlari: ${delCols.deletedCount}
  - O‘chirilgan jurnal yozuvlari: ${delEntries.deletedCount}
  - O‘chirilgan ballar hodisalari: ${delEvents.deletedCount}`)

  await ensureAdminUser()
  await ensureDefaultSubjects()
  console.log('[Tozalash] Tizim to‘liq tozalandi! Faqat asosiy admin hisobi va fanlar qoldi.')
}

export async function seedDatabaseIfNeeded(): Promise<void> {
  await ensureAdminUser()
  await ensureDefaultSubjects()
  await ensureStudentCodes()
}
