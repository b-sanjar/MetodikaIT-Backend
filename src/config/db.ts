import dns from 'node:dns'
import mongoose from 'mongoose'

// Ensure reliable SRV resolution on Windows networks for MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1'])
} catch (_e) {
  // ignore if restricted
}

function maskURI(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')
}

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodika'
  const isAtlas = uri.startsWith('mongodb+srv://')

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: isAtlas ? 15000 : 3000,
    })
    console.log(`[MongoDB] Muvaffaqiyatli ulandi: ${maskURI(uri)}`)
  } catch (err: any) {
    console.warn(`[MongoDB] ${maskURI(uri)} ga ulanib bo‘lmadi: ${err.message}`)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[MongoDB] mongodb-memory-server ishga tushirilmoqda (avtomatik fallback)...')
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server')
        const mongod = await MongoMemoryServer.create()
        const memUri = mongod.getUri()
        await mongoose.connect(memUri)
        console.log(`[MongoDB] In-memory MongoDB muvaffaqiyatli ishga tushdi: ${memUri}`)
      } catch (memErr: any) {
        console.error('[MongoDB] In-memory MongoDB ishga tushirishda xatolik:', memErr.message)
        throw memErr
      }
    } else {
      throw err
    }
  }
}
