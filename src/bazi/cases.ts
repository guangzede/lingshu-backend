import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { and, desc, eq } from 'drizzle-orm'
import { baziCases } from '@/schema'
import { errorResponse, successResponse } from '@/utils/response'
import type { JwtPayload } from '@/utils/types'

interface CloudflareBindings {
  lingshu_db: D1Database
  JWT_SECRET: string
}

export const baziCaseRouter = new Hono<{ Bindings: CloudflareBindings }>()

baziCaseRouter.post('/', async (c) => {
  const db = drizzle(c.env.lingshu_db)
  const payload = c.get('jwtPayload') as JwtPayload | undefined

  if (!payload?.id) {
    return c.json(errorResponse('未授权:请先登录'), 401)
  }

  const body = await c.req.json().catch(() => null)
  if (!body) {
    return c.json(errorResponse('请求体为空'), 400)
  }

  const { pillars } = body
  if (!pillars?.year || !pillars?.month || !pillars?.day || !pillars?.hour) {
    return c.json(errorResponse('缺少必要参数：pillars'), 400)
  }

  const createdAt = Number(body.createdAt || Date.now())
  const now = Date.now()

  try {
    const inserted = await db
      .insert(baziCases)
      .values({
        userId: payload.id,
        name: (body.name || '').trim() || null,
        note: body.note || null,
        birthDate: body.birth?.date || null,
        birthTime: body.birth?.time || null,
        calendar: body.birth?.calendar || null,
        timeMode: body.birth?.timeMode || null,
        gender: body.gender || null,
        manualMode: body.manualMode ? 1 : 0,
        pillars: JSON.stringify(pillars),
        options: body.options ? JSON.stringify(body.options) : null,
        result: body.result ? JSON.stringify(body.result) : null,
        createdAt,
        updatedAt: now
      })
      .returning()

    const newId = inserted?.[0]?.id
    return c.json(successResponse({ id: String(newId) }, '保存成功'))
  } catch (error: any) {
    console.error('[BAZI CASE CREATE ERROR]', error)
    return c.json(errorResponse('保存失败，请稍后重试'), 500)
  }
})

baziCaseRouter.get('/', async (c) => {
  const db = drizzle(c.env.lingshu_db)
  const payload = c.get('jwtPayload') as JwtPayload | undefined

  if (!payload?.id) {
    return c.json(errorResponse('未授权：请先登录'), 401)
  }

  const limit = Number(c.req.query('limit') || 20)
  const offset = Number(c.req.query('offset') || 0)

  try {
    const rows = await db
      .select()
      .from(baziCases)
      .where(eq(baziCases.userId, payload.id))
      .orderBy(desc(baziCases.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    const records = rows.map((row) => ({
      id: String(row.id),
      name: row.name || '',
      birthDate: row.birthDate || '',
      birthTime: row.birthTime || '',
      createdAt: Number(row.createdAt || Date.now()),
      note: row.note || undefined
    }))

    return c.json(successResponse({ count: records.length, limit, offset, records }))
  } catch (error: any) {
    console.error('[BAZI CASE LIST ERROR]', error)
    return c.json(errorResponse('查询失败，请稍后重试'), 500)
  }
})

baziCaseRouter.get('/:id', async (c) => {
  const db = drizzle(c.env.lingshu_db)
  const payload = c.get('jwtPayload') as JwtPayload | undefined

  if (!payload?.id) {
    return c.json(errorResponse('未授权：请先登录'), 401)
  }

  const idParam = c.req.param('id')
  const caseId = Number(idParam)
  if (!caseId || Number.isNaN(caseId)) {
    return c.json(errorResponse('非法ID'), 400)
  }

  try {
    const row = await db
      .select()
      .from(baziCases)
      .where(and(eq(baziCases.userId, payload.id), eq(baziCases.id, caseId)))
      .get()

    if (!row) {
      return c.json(errorResponse('案例不存在'), 404)
    }

    const pillars = JSON.parse(row.pillars || '{}')
    const options = row.options ? JSON.parse(row.options) : null
    const result = row.result ? JSON.parse(row.result) : null

    return c.json(successResponse({
      id: String(row.id),
      name: row.name || '',
      note: row.note || undefined,
      birth: {
        date: row.birthDate || '',
        time: row.birthTime || '',
        calendar: row.calendar || undefined,
        timeMode: row.timeMode || undefined
      },
      gender: row.gender || undefined,
      manualMode: Boolean(row.manualMode),
      pillars,
      options,
      result,
      createdAt: Number(row.createdAt || Date.now())
    }))
  } catch (error: any) {
    console.error('[BAZI CASE DETAIL ERROR]', error)
    return c.json(errorResponse('查询失败，请稍后重试'), 500)
  }
})

baziCaseRouter.delete('/:id', async (c) => {
  const db = drizzle(c.env.lingshu_db)
  const payload = c.get('jwtPayload') as JwtPayload | undefined

  if (!payload?.id) {
    return c.json(errorResponse('未授权：请先登录'), 401)
  }

  const idParam = c.req.param('id')
  const caseId = Number(idParam)
  if (!caseId || Number.isNaN(caseId)) {
    return c.json(errorResponse('非法ID'), 400)
  }

  try {
    const existing = await db
      .select({ id: baziCases.id })
      .from(baziCases)
      .where(and(eq(baziCases.userId, payload.id), eq(baziCases.id, caseId)))
      .get()

    if (!existing) {
      return c.json(errorResponse('案例不存在或已删除'), 404)
    }

    await db
      .delete(baziCases)
      .where(and(eq(baziCases.userId, payload.id), eq(baziCases.id, caseId)))
      .run()

    return c.json(successResponse({ success: true }, '删除成功'))
  } catch (error: any) {
    console.error('[BAZI CASE DELETE ERROR]', error)
    return c.json(errorResponse('删除失败，请稍后重试'), 500)
  }
})

baziCaseRouter.put('/:id', async (c) => {
  const db = drizzle(c.env.lingshu_db)
  const payload = c.get('jwtPayload') as JwtPayload | undefined

  if (!payload?.id) {
    return c.json(errorResponse('未授权：请先登录'), 401)
  }

  const idParam = c.req.param('id')
  const caseId = Number(idParam)
  if (!caseId || Number.isNaN(caseId)) {
    return c.json(errorResponse('非法ID'), 400)
  }

  const body = await c.req.json().catch(() => null)
  if (!body) {
    return c.json(errorResponse('请求体为空'), 400)
  }

  const { pillars } = body
  if (!pillars?.year || !pillars?.month || !pillars?.day || !pillars?.hour) {
    return c.json(errorResponse('缺少必要参数：pillars'), 400)
  }

  const now = Date.now()

  try {
    const result = await db
      .update(baziCases)
      .set({
        name: (body.name || '').trim() || null,
        note: body.note || null,
        birthDate: body.birth?.date || null,
        birthTime: body.birth?.time || null,
        calendar: body.birth?.calendar || null,
        timeMode: body.birth?.timeMode || null,
        gender: body.gender || null,
        manualMode: body.manualMode ? 1 : 0,
        pillars: JSON.stringify(pillars),
        options: body.options ? JSON.stringify(body.options) : null,
        result: body.result ? JSON.stringify(body.result) : null,
        updatedAt: now
      })
      .where(and(eq(baziCases.userId, payload.id), eq(baziCases.id, caseId)))
      .run()

    const changes = (result as { changes?: number } | undefined)?.changes ?? 0
    if (changes <= 0) {
      return c.json(errorResponse('案例不存在或无权限'), 404)
    }

    return c.json(successResponse({ id: String(caseId) }, '更新成功'))
  } catch (error: any) {
    console.error('[BAZI CASE UPDATE ERROR]', error)
    return c.json(errorResponse('更新失败，请稍后重试'), 500)
  }
})
