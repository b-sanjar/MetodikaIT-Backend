import { NextFunction, Request, Response, Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { QuarterInfoModel } from '../models/QuarterInfo.js'

export const quartersRouter = Router()

// GET /api/quarters?grade=X
quartersRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { grade } = req.query
    const parsedGrade = Number(grade)
    if (!grade || isNaN(parsedGrade)) {
      res.status(400).json({ detail: 'Sinf (grade) to‘g‘ri ko‘rsatilishi shart' })
      return
    }

    const infos = await QuarterInfoModel.find({ grade: parsedGrade }).sort({ quarter: 1 })
    res.json(infos)
  } catch (err) {
    next(err)
  }
})
