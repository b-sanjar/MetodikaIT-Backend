import { Router } from 'express'
import { BADGES } from '../data/badges.js'

export const badgesRouter = Router()

// GET /api/badges
badgesRouter.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=43200')
  res.json(BADGES)
})
