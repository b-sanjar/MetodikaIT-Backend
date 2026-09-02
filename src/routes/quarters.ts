import { NextFunction, Request, Response, Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { QuarterInfoModel } from '../models/QuarterInfo.js'

export const quartersRouter = Router()

// GET /api/quarters?grade=X
quartersRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { grade } = req.query
    if (!grade) {
      res.status(400).json({ detail: 'Sinf (grade) ko‘rsatilishi shart' })
      return
    }

    const infos = await QuarterInfoModel.find({ grade: Number(grade) }).sort({ quarter: 1 })
    res.json(infos)
  } catch (err) {
    next(err)
  }
})
