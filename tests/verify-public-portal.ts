import 'dotenv/config'
import http from 'http'
import { app } from '../src/app.js'
import { connectDB } from '../src/config/db.js'
import { StudentModel } from '../src/models/Student.js'
import { seedDatabaseIfNeeded } from '../src/services/seedService.js'

let server: http.Server
const PORT = 8003
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
  console.log('--- 1. Baza va test serverini ishga tushirish ---')
  await connectDB()
  await seedDatabaseIfNeeded()

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`Test server running at ${BASE}`)
      resolve()
    })
  })

  try {
    console.log('\n--- 2. Public Meta Test ---')
    const metaRes = await request('/api/public/meta')
    assert(metaRes.status === 200, 'GET /api/public/meta status 200')
    assert(Array.isArray(metaRes.data.subjects) && metaRes.data.subjects.length > 0, 'Fanlar mavjud')
    assert(Array.isArray(metaRes.data.classes), 'Sinflar massivi qaytdi')

    console.log('\n--- 3. Public Student Lookup Test ---')
    // Find or create a test student
    let student = await StudentModel.findOne().lean()
    if (!student) {
      student = await StudentModel.create({
        id: 'test-st-1',
        name: 'Azizbek Rahimov',
        classId: metaRes.data.classes[0]?.id || 'c-5a',
        code: '123456',
        points: 45,
        badges: ['first-step'],
      })
    }

    const studentCode = student.code || student.id

    // Bad requests
    const noCode = await request('/api/public/student')
    assert(noCode.status === 400, 'Kodsiz so‘rov 400 qaytardi')

    const wrongCode = await request('/api/public/student?code=not-real-code-9999')
    assert(wrongCode.status === 404, 'Mavjud bo‘lmagan kod 404 qaytardi')

    // Valid student lookup
    const found = await request(`/api/public/student?code=${studentCode}`)
    assert(found.status === 200, 'GET /api/public/student muvaffaqiyatli (200)')
    assert(found.data.id === student.id, 'O‘quvchi ID mos keldi')
    assert(found.data.name === student.name, 'O‘quvchi ismi to‘g‘ri')
    assert(found.data.ranks && found.data.ranks.school && found.data.ranks.class, 'Reyting darajalari (ranks) hisoblandi')
    assert(found.data.attendance && typeof found.data.attendance.ratePercent === 'number', 'Davomat statistikasi hisoblandi')
    assert(Array.isArray(found.data.subjectStats), 'Fanlar statistikasi massivi mavjud')

    console.log('\n--- 4. Public Leaderboard Test ---')
    // 4.1 School scope
    const schoolBoard = await request('/api/public/leaderboard?scope=school')
    assert(schoolBoard.status === 200, 'GET /api/public/leaderboard?scope=school status 200')
    assert(Array.isArray(schoolBoard.data), 'Maktab reytingi massiv qaytardi')

    // 4.2 Class scope
    const classBoard = await request(`/api/public/leaderboard?scope=class&classId=${student.classId}`)
    assert(classBoard.status === 200, 'GET /api/public/leaderboard?scope=class status 200')
    assert(Array.isArray(classBoard.data), 'Sinf reytingi massiv qaytardi')

    // 4.3 Parallel scope
    const parallelBoard = await request(`/api/public/leaderboard?scope=parallel&classId=${student.classId}`)
    assert(parallelBoard.status === 200, 'GET /api/public/leaderboard?scope=parallel status 200')
    assert(Array.isArray(parallelBoard.data), 'Tengdosh sinflar reytingi massiv qaytardi')

    // 4.4 Subject filter
    const subjId = metaRes.data.subjects[0]?.id
    const subjectBoard = await request(`/api/public/leaderboard?scope=school&subjectId=${subjId}`)
    assert(subjectBoard.status === 200, 'GET /api/public/leaderboard fan filteri bilan 200')

    console.log('\n🎉 Barcha Public API testlari 100% muvaffaqiyatli yakunlandi!')
  } finally {
    server.close()
    process.exit(0)
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err)
  if (server) server.close()
  process.exit(1)
})
