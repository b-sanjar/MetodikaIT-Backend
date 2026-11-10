import 'dotenv/config'
import { app } from './app.js'
import { connectDB } from './config/db.js'
import { seedDatabaseIfNeeded } from './services/seedService.js'

const PORT = Number(process.env.PORT) || 8000

async function bootstrap() {
  try {
    console.log('[Server] MetodikaIT backend ishga tushirilmoqda...')
    await connectDB()
    await seedDatabaseIfNeeded()

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] MetodikaIT Backend port ${PORT} da muvaffaqiyatli ishga tushdi 🚀`)
    })
  } catch (error) {
    console.error('[Server] Ishga tushirishda xatolik:', error)
    process.exit(1)
  }
}

bootstrap()
