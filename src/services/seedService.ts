import bcrypt from 'bcryptjs'
import { ClassGroupModel } from '../models/ClassGroup.js'
import { JournalColumnModel } from '../models/JournalColumn.js'
import { JournalEntryModel } from '../models/JournalEntry.js'
import { LessonModel } from '../models/Lesson.js'
import { PointsEventModel } from '../models/PointsEvent.js'
import { QuarterInfoModel } from '../models/QuarterInfo.js'
import { StudentModel } from '../models/Student.js'
import { TeacherModel } from '../models/Teacher.js'
import { UserModel } from '../models/User.js'

export async function ensureAdminUser(): Promise<void> {
  const adminLogin = process.env.ADMIN_LOGIN || 'sanjarpuls18@gmail.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'AXL007_c3'
  const adminName = process.env.ADMIN_NAME || 'Sanjar Burxonov'

  const passwordHash = await bcrypt.hash(adminPassword, 10)

  // Remove any legacy admin or users with other logins
  await UserModel.deleteMany({ login: { $ne: adminLogin } })

  const admin = await UserModel.findOne({ login: adminLogin })
  if (!admin) {
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
    admin.name = adminName
    admin.passwordHash = passwordHash
    admin.role = 'admin'
    admin.title = 'Platforma administratori'
    await admin.save()
    console.log(`[Admin] Admin hisobi yangilandi: ${adminName} (${adminLogin})`)
  }
}

/**
 * Completely clean all data from the database (lessons, classes, teachers, students, journals)
 * and ensure ONLY the primary admin user exists.
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
  console.log('[Tozalash] Tizim to‘liq tozalandi! Faqat asosiy admin hisobi qoldi.')
}

export async function seedDatabaseIfNeeded(): Promise<void> {
  await ensureAdminUser()
}
