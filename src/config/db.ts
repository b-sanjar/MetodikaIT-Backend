import dns from 'node:dns'
import mongoose from 'mongoose'

// Ensure reliable SRV resolution for MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1'])
} catch (_e) {
  // ignore if restricted
}

function maskURI(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')
}

let isListenerRegistered = false

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodika'
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

  try {
    await mongoose.connect(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: isAtlas ? 10000 : 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      autoIndex: process.env.NODE_ENV !== 'production',
    })
    console.log(`[MongoDB] Muvaffaqiyatli ulandi: ${maskURI(uri)}`)
  } catch (err: any) {
    console.error(`[MongoDB] Ulanishda xatolik (${maskURI(uri)}):`, err.message)
    throw err
  }
}
