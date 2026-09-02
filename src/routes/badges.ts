import { Router } from 'express'
import { BADGES } from '../data/badges.js'

export const badgesRouter = Router()

// GET /api/badges
badgesRouter.get('/', (_req, res) => {
  res.json(BADGES)
})
