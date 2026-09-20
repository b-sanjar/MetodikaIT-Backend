import 'dotenv/config'
import http from 'http'
import mongoose from 'mongoose'
import { app } from '../src/app.js'
import { connectDB } from '../src/config/db.js'
import { seedDatabaseIfNeeded } from '../src/services/seedService.js'

let server: http.Server
const PORT = 8009
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
  return { status: res.status, ok: res.ok, headers: res.headers, data }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`  ✓ ${message}`)
}

async function run() {
  console.log('=== 1. DB ulanishi va serverni ishga tushirish ===')
  const startTime = Date.now()
  await connectDB()
  assert(mongoose.connection.readyState === 1, 'MongoDB connection readyState === 1')

  await seedDatabaseIfNeeded()
  console.log(`  ✓ Startup va seed vaqti: ${Date.now() - startTime}ms`)

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`  ✓ Test server ${BASE} portida ishga tushdi`)
      resolve()
    })
  })

  try {
    console.log('\n=== 2. Health & Performance Logger Test ===')
    const health = await request('/api/health')
    assert(health.status === 200, 'Health check 200 OK qaytardi')
    assert(health.data.status === 'ok', 'Health status === ok')

    console.log('\n=== 3. Badges & HTTP Caching Test ===')
    const badges = await request('/api/badges')
    assert(badges.status === 200, 'GET /api/badges 200 OK qaytardi')
    assert(Array.isArray(badges.data) && badges.data.length > 0, 'Badges array qaytdi')
    const cacheHeader = badges.headers.get('cache-control')
    assert(Boolean(cacheHeader && cacheHeader.includes('max-age')), `Cache-Control mavjud: ${cacheHeader}`)

    console.log('\n=== 4. Auth & Admin Login Test ===')
    const adminLogin = process.env.ADMIN_LOGIN || 'burxonovsanjar21@gmail.com'
    const adminPassword = process.env.ADMIN_PASSWORD || 'AXL007_c3'

    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: adminLogin, password: adminPassword }),
    })
    assert(loginRes.status === 200, `Admin (${adminLogin}) login muvaffaqiyatli`)
    assert(loginRes.data.user.role === 'admin', 'Admin roli to‘g‘ri')
    const token = loginRes.data.token
    assert(Boolean(token), 'JWT token muvaffaqiyatli olindi')

    console.log('\n=== 5. In-Memory Auth Cache & GET /api/auth/me Test ===')
    const t0 = Date.now()
    const me1 = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const me1Time = Date.now() - t0
    assert(me1.status === 200 && me1.data.login === adminLogin, `Birinchi /me so‘rovi: ${me1Time}ms`)

    const t1 = Date.now()
    const me2 = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const me2Time = Date.now() - t1
    assert(me2.status === 200 && me2.data.login === adminLogin, `Ikkinchi /me so‘rovi (keshlangan): ${me2Time}ms`)

    console.log('\n=== 6. Optimized Queries: Classes, Subjects, Lessons Summary ===')
    const classes = await request('/api/classes', {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert(classes.status === 200, 'GET /api/classes 200 OK')
    assert(Array.isArray(classes.data), 'Classes ro‘yxati qaytdi')

    const subjects = await request('/api/subjects', {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert(subjects.status === 200, 'GET /api/subjects (aggregation) 200 OK')
    assert(Array.isArray(subjects.data) && subjects.data.length > 0, 'Fanlar ro‘yxati qaytdi')
    assert('teacherCount' in subjects.data[0], 'Fanlar teacherCount maydoniga ega')

    const summaries = await request('/api/lessons/summary', {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert(summaries.status === 200, 'GET /api/lessons/summary (aggregation) 200 OK')
    assert(Array.isArray(summaries.data) && summaries.data.length === 11, '11 ta sinf statistikasi hisoblandi')

    const students = await request('/api/students', {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert(students.status === 200, 'GET /api/students 200 OK')
    assert(Array.isArray(students.data), 'Students ro‘yxati qaytdi')

    const leaderboard = await request('/api/leaderboard?period=all', {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert(leaderboard.status === 200, 'GET /api/leaderboard 200 OK')
    assert(Array.isArray(leaderboard.data), 'Leaderboard ro‘yxati qaytdi')

    console.log('\n🎉 BARCHA BACKEND OPTIMIZATSIYA TESTLARI MUVAFFAQIYATLI O‘TDI!')
  } finally {
    server?.close()
    await mongoose.disconnect()
    console.log('Test server va MongoDB ulanishi to‘xtatildi.')
  }
}

run().catch((err) => {
  console.error('Testda xatolik:', err)
  process.exit(1)
})
