import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { errorResponse, successResponse } from '@/utils/response'
import { computeBaziChart } from '@/services/bazi'
import { STEMS, BRANCHES } from '@/services/bazi/constants'
import { buildBaziYearReport } from '@/services/bazi/report'
import type { Stem, Branch } from '@/types/liuyao'
import { users } from '@/schema'
import type { JwtPayload } from '@/utils/types'

interface CloudflareBindings {
  lingshu_db: D1Database
  JWT_SECRET: string
}

export const baziRouter = new Hono<{ Bindings: CloudflareBindings }>()

const YANG_STEMS: Stem[] = ['甲', '丙', '戊', '庚', '壬']
const YANG_BRANCHES: Branch[] = ['子', '寅', '辰', '午', '申', '戌']

function isStem(value: any): value is typeof STEMS[number] {
  return typeof value === 'string' && STEMS.includes(value as any)
}

function isBranch(value: any): value is typeof BRANCHES[number] {
  return typeof value === 'string' && BRANCHES.includes(value as any)
}

function isStemBranchYinYangMatch(stem: Stem, branch: Branch): boolean {
  const stemIsYang = YANG_STEMS.includes(stem)
  const branchIsYang = YANG_BRANCHES.includes(branch)
  return stemIsYang === branchIsYang
}

baziRouter.post('/compute', async (c) => {
  let body: any = null
  try {
    body = await c.req.json().catch(() => null)
  } catch (err) {
    return c.json(errorResponse('请求体格式错误'), 400)
  }

  if (!body?.pillars) {
    return c.json(errorResponse('缺少pillars参数'), 400)
  }

  const { year, month, day, hour } = body.pillars
  if (!isStem(year?.stem) || !isBranch(year?.branch) || !isStem(month?.stem) || !isBranch(month?.branch) || !isStem(day?.stem) || !isBranch(day?.branch) || !isStem(hour?.stem) || !isBranch(hour?.branch)) {
    return c.json(errorResponse('pillars字段不合法'), 400)
  }
  if (
    !isStemBranchYinYangMatch(year.stem, year.branch) ||
    !isStemBranchYinYangMatch(month.stem, month.branch) ||
    !isStemBranchYinYangMatch(day.stem, day.branch) ||
    !isStemBranchYinYangMatch(hour.stem, hour.branch)
  ) {
    return c.json(errorResponse('天干地支阴阳需同柱匹配（阳干配阳支，阴干配阴支）'), 400)
  }

  try {
    const result = computeBaziChart({
      pillars: {
        year: { stem: year.stem, branch: year.branch },
        month: { stem: month.stem, branch: month.branch },
        day: { stem: day.stem, branch: day.branch },
        hour: { stem: hour.stem, branch: hour.branch }
      },
      gender: body.gender,
      directionRule: body.directionRule,
      luckStart: body.luckStart,
      options: body.options,
      birth: body.birth
    })

    return c.json(successResponse({ result }))
  } catch (err: any) {
    console.error('[BAZI COMPUTE ERROR]', err)
    return c.json(errorResponse('排盘计算失败'), 500)
  }
})

baziRouter.post('/ai-report', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload | undefined
  if (!payload?.id) {
    return c.json(errorResponse('未授权：请先登录'), 401)
  }

  let body: any = null
  try {
    body = await c.req.json().catch(() => null)
  } catch (err) {
    return c.json(errorResponse('请求体格式错误'), 400)
  }

  if (!body?.pillars) {
    return c.json(errorResponse('缺少pillars参数'), 400)
  }

  const { year, month, day, hour } = body.pillars
  if (!isStem(year?.stem) || !isBranch(year?.branch) || !isStem(month?.stem) || !isBranch(month?.branch) || !isStem(day?.stem) || !isBranch(day?.branch) || !isStem(hour?.stem) || !isBranch(hour?.branch)) {
    return c.json(errorResponse('pillars字段不合法'), 400)
  }
  if (
    !isStemBranchYinYangMatch(year.stem, year.branch) ||
    !isStemBranchYinYangMatch(month.stem, month.branch) ||
    !isStemBranchYinYangMatch(day.stem, day.branch) ||
    !isStemBranchYinYangMatch(hour.stem, hour.branch)
  ) {
    return c.json(errorResponse('天干地支阴阳需同柱匹配（阳干配阳支，阴干配阴支）'), 400)
  }

  const db = drizzle(c.env.lingshu_db)
  const user = await db.select().from(users).where(eq(users.id, payload.id)).get()
  if (!user) {
    return c.json(errorResponse('用户不存在'), 404)
  }

  const isUnlocked = user.memberLevel === 1 && user.memberExpireAt > Date.now()

  try {
    const result = computeBaziChart({
      pillars: {
        year: { stem: year.stem, branch: year.branch },
        month: { stem: month.stem, branch: month.branch },
        day: { stem: day.stem, branch: day.branch },
        hour: { stem: hour.stem, branch: hour.branch }
      },
      gender: body.gender,
      directionRule: body.directionRule,
      luckStart: body.luckStart,
      options: body.options,
      birth: body.birth
    })

    const report = buildBaziYearReport(result, 2026)
    return c.json(successResponse({
      year: report.year,
      ganZhi: report.ganZhi,
      yearElement: report.yearElement,
      yearTenGod: report.yearTenGod,
      isUnlocked,
      report: isUnlocked ? report.fullText : report.previewText,
      preview: report.previewText
    }))
  } catch (err: any) {
    console.error('[BAZI AI REPORT ERROR]', err)
    return c.json(errorResponse('生成运势报告失败'), 500)
  }
})
