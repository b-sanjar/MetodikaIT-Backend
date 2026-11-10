import dns from 'node:dns'
import mongoose from 'mongoose'

function maskURI(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')
}

let isListenerRegistered = false

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/metodika'
  const isAtlas = uri.startsWith('mongodb+srv://')

  if (!isListenerRegistered) {
    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB Xatolik]:', err.message)
    })
    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Ulanish uzildi')
    })
    mongoose.connection.on('reconnected', () => {
      console.log('[MongoDB] Qayta ulandi')
    })
    isListenerRegistered = true
  }

  const connectOptions: mongoose.ConnectOptions = {
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: isAtlas ? 8000 : 4000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    autoIndex: process.env.NODE_ENV !== 'production',
  }

  try {
    // Attempt 1: Standard OS DNS resolver
    await mongoose.connect(uri, connectOptions)
    console.log(`[MongoDB] Muvaffaqiyatli ulandi: ${maskURI(uri)}`)
  } catch (err: any) {
    // If Atlas SRV resolution failed on custom networks, try public DNS fallback
    if (isAtlas && (err.message?.includes('ENOTFOUND') || err.message?.includes('ESERVFAIL'))) {
      try {
        console.log('[MongoDB] Standart DNS orqali ulanish amalga oshmadi. Zaxira DNS (8.8.8.8) orqali urinib ko‘rilmoqda...')
        dns.setServers(['8.8.8.8', '1.1.1.1'])
        await mongoose.connect(uri, connectOptions)
        console.log(`[MongoDB] Muvaffaqiyatli ulandi (zaxira DNS): ${maskURI(uri)}`)
        return
      } catch (fallbackErr: any) {
        console.error(`[MongoDB] Zaxira DNS orqali ham ulanib bo‘lmadi:`, fallbackErr.message)
      }
    }
    console.error(`[MongoDB] Ulanishda xatolik (${maskURI(uri)}):`, err.message)
    throw err
  }
}
