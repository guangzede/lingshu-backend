import { Hono } from 'hono'
import { errorResponse, successResponse } from '@/utils/response'
import { computeDaLiuRenChart } from '@/services/daliuren'
import { BRANCHES, STEMS } from '@/services/daliuren/constants'
import type { Branch, Stem } from '@/types/liuyao'

interface CloudflareBindings {
  lingshu_db: D1Database
  JWT_SECRET: string
}

export const daliurenRouter = new Hono<{ Bindings: CloudflareBindings }>()

function isStem(value: any): value is Stem {
  return typeof value === 'string' && STEMS.includes(value as any)
}

function isBranch(value: any): value is Branch {
  return typeof value === 'string' && BRANCHES.includes(value as any)
}

daliurenRouter.post('/compute', async (c) => {
  let body: any = null
  try {
    body = await c.req.json().catch(() => null)
  } catch (err) {
    return c.json(errorResponse('请求体格式错误'), 400)
  }

  const datetime = body?.datetime
  if (!datetime || typeof datetime.year !== 'number') {
    return c.json(errorResponse('缺少datetime参数'), 400)
  }

  if (body?.manualPillars) {
    const { year, month, day, hour } = body.manualPillars
    if (!isStem(year?.stem) || !isBranch(year?.branch) ||
        !isStem(month?.stem) || !isBranch(month?.branch) ||
        !isStem(day?.stem) || !isBranch(day?.branch) ||
        !isStem(hour?.stem) || !isBranch(hour?.branch)) {
      return c.json(errorResponse('manualPillars字段不合法'), 400)
    }
  }

  try {
    const result = computeDaLiuRenChart({
      datetime,
      calendar: body?.calendar,
      lunarLeap: body?.lunarLeap,
      timeMode: body?.timeMode,
      manualPillars: body?.manualPillars
    })
    return c.json(successResponse({ result }))
  } catch (err: any) {
    console.error('[DALUIREN COMPUTE ERROR]', err)
    return c.json(errorResponse('排盘计算失败'), 500)
  }
})
