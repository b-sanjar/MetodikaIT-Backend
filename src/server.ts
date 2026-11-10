import 'dotenv/config'
import { app } from './app.js'
import { connectDB } from './config/db.js'
import { seedDatabaseIfNeeded } from './services/seedService.js'

const PORT = Number(process.env.PORT) || 8000

// 1. HTTP serverni DARHOL ishga tushirish (port 8000 ochiladi va health-check javob beradi)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] MetodikaIT Backend port ${PORT} da muvaffaqiyatli ishga tushdi 🚀`)
  console.log(`[Server] URL: http://localhost:${PORT}`)
  console.log(`[Server] Muhit: ${process.env.NODE_ENV || 'development'}`)
})

// 2. Ma'lumotlar bazasiga avto-qayta ulanish (resilient auto-retry)
let isConnecting = false

async function initDB() {
  if (isConnecting) return
  isConnecting = true
  try {
    console.log('[MongoDB] Ma’lumotlar bazasiga ulanish kutilmoqda...')
    await connectDB()
    console.log('[MongoDB] Ma’lumotlar bazasiga muvaffaqiyatli ulandi!')
    await seedDatabaseIfNeeded()
    console.log('[Database] Tizim boshlang‘ich ma’lumotlari tayyor ✅')
  } catch (error: any) {
    console.error('[MongoDB] Ulanishda uzilish yuz berdi:', error?.message || error)
    console.log('[MongoDB] 5 soniyadan so‘ng qayta ulanishga harakat qilinadi...')
    setTimeout(() => {
      isConnecting = false
      initDB()
    }, 5000)
  }
}

initDB()

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM signali qabul qilindi, server to‘xtatilmoqda...')
  server.close(() => {
    process.exit(0)
  })
})
