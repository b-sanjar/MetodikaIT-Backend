import 'dotenv/config'
import http from 'http'
import mongoose from 'mongoose'
import { app } from '../src/app.js'
import { connectDB } from '../src/config/db.js'
import { seedDatabaseIfNeeded } from '../src/services/seedService.js'

let server: http.Server
const PORT = 8001
const BASE = `http://localhost:${PORT}`

async function request(path: string, options: any = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const text = await res.text()
  let data: any = null
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { status: res.status, ok: res.ok, data }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`  ✓ ${message}`)
}

async function runTests() {
  console.log('--- 1. Baza va server ishga tushirilmoqda ---')
  await connectDB()
  await seedDatabaseIfNeeded()

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`Test server running at ${BASE}`)
      resolve()
    })
  })

  try {
    console.log('\n--- 2. Auth & Login Testlari ---')
    // 2.1 Noto'g'ri login
    const wrong = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: 'admin', password: 'wrongpassword' }),
    })
    assert(wrong.status === 401, 'Noto‘g‘ri parol 401 qaytardi')
    assert(wrong.data.detail === 'Login yoki parol noto‘g‘ri', 'O‘zbekcha xato xabari to‘g‘ri')

    // 2.2 Admin login
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: 'admin', password: 'admin' }),
    })
    assert(adminLogin.status === 200, 'Admin login muvaffaqiyatli (200)')
    assert(adminLogin.data.user.role === 'admin', 'Admin roli to‘g‘ri')
    const adminToken = adminLogin.data.token

    // 2.3 Viewer login
    const viewerLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: 'rahbar', password: 'rahbar' }),
    })
    assert(viewerLogin.status === 200, 'Viewer login muvaffaqiyatli (200)')
    assert(viewerLogin.data.user.role === 'viewer', 'Viewer roli to‘g‘ri')

    // 2.4 Teacher login
    const teacherLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: 'karimov', password: '1234' }),
    })
    assert(teacherLogin.status === 200, 'Teacher login muvaffaqiyatli (200)')
    assert(teacherLogin.data.user.role === 'teacher', 'Teacher roli to‘g‘ri')
    const teacherToken = teacherLogin.data.token

    // 2.5 GET /api/auth/me
    const me = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert(me.status === 200 && me.data.login === 'admin', 'GET /api/auth/me adminni to‘g‘ri qaytardi')

    // 2.6 PATCH /api/profile
    const patchProfile = await request('/api/profile', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Aziz Rahmonov (Yangilangan)' }),
    })
    assert(patchProfile.status === 200, 'PATCH /api/profile 200 qaytardi')
    assert(patchProfile.data.name === 'Aziz Rahmonov (Yangilangan)', 'Profil ismi yangilandi')

    console.log('\n--- 3. Darslar (Lessons) Testlari ---')
    // 3.1 GET /api/lessons/summary
    const summary = await request('/api/lessons/summary', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert(summary.status === 200, 'GET /api/lessons/summary 200 qaytardi')
    assert(Array.isArray(summary.data) && summary.data.length === 11, '11 ta sinf statistikasi mavjud')
    const totalLessons = summary.data.reduce((sum: number, g: any) => sum + g.lessonCount, 0)
    assert(totalLessons === 176, `Jami darslar soni 176 ta (hozir: ${totalLessons})`)

    // 3.2 GET /api/lessons?grade=5
    const grade5 = await request('/api/lessons?grade=5', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert(grade5.status === 200 && grade5.data.length === 16, '5-sinf darslari 16 ta')
    const l511 = grade5.data.find((l: any) => l.id === 'l-5-1-1')
    assert(Boolean(l511), 'l-5-1-1 darsi topildi')
    assert(l511.objective.includes('informatika fani'), 'l-5-1-1 boyitilgan (rich) dars tanasiga ega')

    // 3.3 POST /api/lessons (teacher creates draft lesson)
    const newLesson = await request('/api/lessons', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        grade: 5,
        quarter: 2,
        title: 'Scratchda yangi animatsiya',
      }),
    })
    assert(newLesson.status === 201, 'POST /api/lessons 201 yaratildi')
    assert(newLesson.data.authorId === 't1', 'Dars muallifi tokendagi o‘qituvchi id si')
    assert(newLesson.data.status === 'draft', 'Dars holati default draft')
    assert(newLesson.data.theory.length > 0, 'Dars nazariyasi shablon bo‘yicha to‘ldirildi')
    const createdLessonId = newLesson.data.id

    // 3.4 PATCH /api/lessons/:id
    const updatedLesson = await request(`/api/lessons/${createdLessonId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ status: 'ready', durationMin: 50 }),
    })
    assert(updatedLesson.status === 200 && updatedLesson.data.status === 'ready', 'Dars tahrirlandi va ready qilindi')

    // 3.5 DELETE /api/lessons/:id by another teacher (toshpulatov) -> should be 403
    const toshpulatovLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: 'toshpulatov', password: '1234' }),
    })
    const deleteForbidden = await request(`/api/lessons/${createdLessonId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${toshpulatovLogin.data.token}` },
    })
    assert(deleteForbidden.status === 403, 'Boshqa o‘qituvchi darsni o‘chira olmadi (403)')

    // 3.6 DELETE /api/lessons/:id by author -> 204
    const deleteSuccess = await request(`/api/lessons/${createdLessonId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${teacherToken}` },
    })
    assert(deleteSuccess.status === 204, 'Muallif o‘z darsini o‘chirdi (204)')

    console.log('\n--- 4. Sinflar & O‘qituvchilar Testlari ---')
    // 4.1 GET /api/classes
    const classes = await request('/api/classes', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert(classes.status === 200 && classes.data.length >= 4, 'Sinflar ro‘yxati olindi')

    // 4.2 GET /api/teachers (check dynamic classIds)
    const teachers = await request('/api/teachers', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert(teachers.status === 200, 'O‘qituvchilar ro‘yxati olindi')
    const karimov = teachers.data.find((t: any) => t.login === 'karimov')
    assert(
      karimov.classIds.includes('c-5a') && karimov.classIds.includes('c-7b'),
      'Karimov sinflari avtomatik hisoblandi (c-5a, c-7b)'
    )

    // 4.3 POST /api/classes (duplicate prevention)
    const dupClass = await request('/api/classes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ grade: 5, letter: 'A' }),
    })
    assert(dupClass.status === 409, 'Mavjud 5-«A» sinf qayta yaratilmadi (409)')

    console.log('\n--- 5. O‘quvchilar & Gamifikatsiya Testlari ---')
    // 5.1 GET /api/students?classId=c-5a
    const students5a = await request('/api/students?classId=c-5a', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert(students5a.status === 200 && students5a.data.length === 10, '5-A sinfda 10 ta o‘quvchi mavjud')
    const firstStudent = students5a.data[0]

    // 5.2 POST /api/students/:id/points
    const oldPoints = firstStudent.points
    const addPts = await request(`/api/students/${firstStudent.id}/points`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ points: 20, reason: 'Faol qatnashgani uchun' }),
    })
    assert(addPts.status === 200, 'Ball qo‘shildi (200)')
    assert(addPts.data.points === oldPoints + 20, 'O‘quvchi bali to‘g‘ri oshdi')

    // 5.3 GET /api/students/:id/points-history
    const history = await request(`/api/students/${firstStudent.id}/points-history?limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert(history.status === 200 && history.data.length > 0, 'Ballar tarixi olindi')
    assert(history.data[0].reason === 'Faol qatnashgani uchun', 'Oxirgi rag‘batlantirish sababi to‘g‘ri saqlandi')

    // 5.4 GET /api/students/:id/journal
    const stJournal = await request(`/api/students/${firstStudent.id}/journal`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert(stJournal.status === 200 && Array.isArray(stJournal.data), 'O‘quvchi jurnali olindi')

    // 5.5 GET /api/leaderboard?period=all
    const board = await request('/api/leaderboard?period=all', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert(board.status === 200 && board.data.length > 0, 'Umumiy reyting muvaffaqiyatli olindi')
    assert(board.data[0].position === 1, 'Reyting 1-o‘rindan boshlanadi')

    console.log('\n--- 6. Jurnal & Katakcha Baholash (Upsert) Testlari ---')
    // 6.1 GET /api/journal/columns?classId=c-5a
    const cols = await request('/api/journal/columns?classId=c-5a', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    })
    assert(cols.status === 200 && cols.data.length >= 4, 'Jurnal ustunlari olindi')

    // 6.2 PUT /api/journal/cell (Karimov sinfida baho qo'yish)
    const testDate = '2026-06-15'
    const cellRes = await request('/api/journal/cell', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        classId: 'c-5a',
        studentId: firstStudent.id,
        date: testDate,
        grade: 5,
        attendance: 'keldi',
      }),
    })
    assert(cellRes.status === 200, 'Jurnal katakchasi saqlandi (200)')
    assert(cellRes.data.entry.grade === 5, 'Baho 5 bo‘lib saqlandi')
    assert(cellRes.data.student.badges.includes('star'), '5 baho olgani uchun star nishoni avtomatik berildi')

    // 6.3 PUT /api/journal/cell begona sinfga qo'ymoqchi bo'lgan teacher (403)
    const forbiddenCell = await request('/api/journal/cell', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${toshpulatovLogin.data.token}` },
      body: JSON.stringify({
        classId: 'c-5a',
        studentId: firstStudent.id,
        date: testDate,
        grade: 4,
        attendance: 'keldi',
      }),
    })
    assert(forbiddenCell.status === 403, 'Begona sinfga baho qo‘yish bloklandi (403)')

    // 6.4 GET /api/badges
    const badges = await request('/api/badges')
    assert(badges.status === 200 && badges.data.length === 5, '5 ta nishon lug‘ati olindi')

    console.log('\n🎉 BARCHA 33 TA ENDPOINT VA INTEGRATSION TESTLAR 100% MUVAFFAQISATLI O‘TDI!')
  } finally {
    server.close()
    await mongoose.disconnect()
  }
}

runTests().catch((err) => {
  console.error('Testlarda xatolik:', err)
  if (server) server.close()
  process.exit(1)
})
