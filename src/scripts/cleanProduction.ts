import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { cleanEverything } from '../services/seedService.js'

async function run() {
  try {
    await connectDB()
    await cleanEverything()
    console.log('✅ Barcha mavzular va test ma’lumotlari o‘chirildi. Asosiy admin tayyorlandi!')
    await mongoose.disconnect()
    process.exit(0)
  } catch (err) {
    console.error('Xatolik:', err)
    process.exit(1)
  }
}

run()
