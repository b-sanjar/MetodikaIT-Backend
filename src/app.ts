import compression from 'compression'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { errorHandler } from './middleware/error.js'
import { authRouter, profileRouter } from './routes/auth.js'
import { badgesRouter } from './routes/badges.js'
import { classesRouter } from './routes/classes.js'
import { journalRouter } from './routes/journal.js'
import { leaderboardRouter } from './routes/leaderboard.js'
import { lessonsRouter } from './routes/lessons.js'
import { publicRouter } from './routes/public.js'
import { quartersRouter } from './routes/quarters.js'
import { studentsRouter } from './routes/students.js'
import { subjectsRouter } from './routes/subjects.js'
import { teachersRouter } from './routes/teachers.js'

export const app = express()

// Gzip/deflate compression for all responses
app.use(compression())

// Security headers with helmet
app.use(
  helmet({
    crossOriginResourcePolicy: false, // allows images/photos to load in cross-origin environments
    crossOriginOpenerPolicy: false,
  })
)

// CORS configuration
const allowedOrigin = process.env.CLIENT_URL || true
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
)

// Response time and request monitoring middleware
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    if (req.originalUrl !== '/api/health') {
      console.log(`[API] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`)
    }
  })
  next()
})

// Parse JSON request body (up to 15MB for base64 photo avatars)
app.use(express.json({ limit: '15mb' }))
app.use(express.urlencoded({ extended: true, limit: '15mb' }))

// Rate limiting for login (brute force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // max 30 login attempts per 15 min per IP
  message: { detail: 'Juda ko‘p noto‘g‘ri urinishlar qilindi. Iltimos, 15 daqiqadan so‘ng qayta urinib ko‘ring.' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/auth/login', loginLimiter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()), time: new Date().toISOString() })
})

// Mount routers
app.use('/api/auth', authRouter)
app.use('/api/profile', profileRouter)
app.use('/api/teachers', teachersRouter)
app.use('/api/classes', classesRouter)
app.use('/api/lessons', lessonsRouter)
app.use('/api/quarters', quartersRouter)
app.use('/api/students', studentsRouter)
app.use('/api/journal', journalRouter)
app.use('/api/leaderboard', leaderboardRouter)
app.use('/api/badges', badgesRouter)
app.use('/api/subjects', subjectsRouter)
app.use('/api/public', publicRouter)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ detail: 'Bunday sahifa yoki API marshrut topilmadi' })
})

// Global error handler
app.use(errorHandler)
