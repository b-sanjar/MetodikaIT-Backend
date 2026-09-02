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

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodika'
  const isAtlas = uri.startsWith('mongodb+srv://')

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: isAtlas ? 15000 : 5000,
    })
    console.log(`[MongoDB] Muvaffaqiyatli ulandi: ${maskURI(uri)}`)
  } catch (err: any) {
    console.error(`[MongoDB] Ulanishda xatolik (${maskURI(uri)}):`, err.message)
    throw err
  }
}
