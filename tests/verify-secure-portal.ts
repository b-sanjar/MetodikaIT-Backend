import 'dotenv/config'
import http from 'http'
import { app } from '../src/app.js'
import { connectDB } from '../src/config/db.js'
import { StudentModel } from '../src/models/Student.js'
import { seedDatabaseIfNeeded } from '../src/services/seedService.js'

let server: http.Server
const PORT = 8005
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
  console.log('=== 1. Xavfsizlik Testi: Baza va server ishga tushirilmoqda ===')
  await connectDB()
  await seedDatabaseIfNeeded()

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`Test server running at ${BASE}`)
      resolve()
    })
  })

  try {
    console.log('\n=== 2. API Yopiqligi va Himoyasi (Unauthorized Access Blocker) ===')
    // 2.1 Tokensiz/kodsiz reyting so‘rovi taqiqlanishi kerak (401)
    const blockedLeaderboard = await request('/api/public/leaderboard')
    assert(blockedLeaderboard.status === 401, 'Ruxsatsiz reyting so‘rovi 401 (Unauthorized) bilan bloklandi')
    assert(blockedLeaderboard.data.detail.includes('PIN-kodini kiritishingiz shart'), 'Tushunarli xavfsizlik xabari berildi')

    // 2.2 Tokensiz o‘quvchi ma’lumotlari so‘rovi taqiqlanishi kerak (401)
    const blockedStudent = await request('/api/public/student')
    assert(blockedStudent.status === 401, 'Ruxsatsiz o‘quvchi so‘rovi 401 bilan bloklandi')

    // 2.3 Noto‘g‘ri PIN orqali kirish urinishi (404)
    const wrongPin = await request('/api/public/verify', {
      method: 'POST',
      body: JSON.stringify({ code: '000000_not_found' }),
    })
    assert(wrongPin.status === 404, 'Mavjud bo‘lmagan PIN 404 qaytardi')

    console.log('\n=== 3. To‘g‘ri PIN orqali Autentifikatsiya va Token Olish ===')
    const realStudent = await StudentModel.findOne().lean()
    assert(Boolean(realStudent), 'Bazada kamida 1 ta o‘quvchi mavjud')

    const studentPin = realStudent!.code || realStudent!.id
    console.log(`  * Sinov uchun olingan PIN: ${studentPin} (${realStudent!.name})`)

    const verifyRes = await request('/api/public/verify', {
      method: 'POST',
      body: JSON.stringify({ code: studentPin }),
    })
    assert(verifyRes.status === 200, 'POST /api/public/verify 200 OK qaytardi')
    assert(typeof verifyRes.data.token === 'string', 'Parent JWT token generatsiya qilindi')
    assert(verifyRes.data.student.name === realStudent!.name, 'Farzand ma’lumotlari to‘g‘ri qaytdi')

    const parentToken = verifyRes.data.token

    console.log('\n=== 4. Parent Token orqali Himoyalangan API’lardan Foydalanish ===')
    // 4.1 Token bilan o‘quvchi profili
    const studentRes = await request('/api/public/student', {
      headers: { Authorization: `Bearer ${parentToken}` },
    })
    assert(studentRes.status === 200, 'Token orqali GET /api/public/student 200 OK qaytdi')
    assert(studentRes.data.ranks.school.position > 0, 'Maktab reytingidagi o‘rni hisoblangan')

    // 4.2 Token bilan reyting jadvali
    const boardRes = await request('/api/public/leaderboard?scope=school', {
      headers: { Authorization: `Bearer ${parentToken}` },
    })
    assert(boardRes.status === 200, 'Token orqali GET /api/public/leaderboard 200 OK qaytdi')
    assert(Array.isArray(boardRes.data) && boardRes.data.length > 0, 'Reyting ro‘yxati muvaffaqiyatli olindi')

    // 4.3 Parallel sinflar reytingi
    const parallelRes = await request('/api/public/leaderboard?scope=parallel', {
      headers: { Authorization: `Bearer ${parentToken}` },
    })
    assert(parallelRes.status === 200, 'Token orqali tengdosh sinflar reytingi 200 OK qaytdi')

    // 4.4 Meta ma’lumotlar
    const metaRes = await request('/api/public/meta', {
      headers: { Authorization: `Bearer ${parentToken}` },
    })
    assert(metaRes.status === 200, 'Token orqali GET /api/public/meta 200 OK qaytdi')

    console.log('\n🎉 BARCHA XAVFSIZLIK VA PIN AUTENTIFIKATSIYA TESTLARI 100% MUVAFFAQIYATLI O‘TDI!')
  } finally {
    server.close()
    process.exit(0)
  }
}

runTests().catch((err) => {
  console.error('Security test failed:', err)
  if (server) server.close()
  process.exit(1)
})
