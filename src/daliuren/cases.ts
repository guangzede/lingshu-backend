import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { and, desc, eq } from 'drizzle-orm'
import { daliurenCases } from '@/schema'
import { errorResponse, successResponse } from '@/utils/response'
import type { JwtPayload } from '@/utils/types'

interface CloudflareBindings {
  lingshu_db: D1Database
  JWT_SECRET: string
}

export const daliurenCaseRouter = new Hono<{ Bindings: CloudflareBindings }>()

daliurenCaseRouter.post('/', async (c) => {
  const db = drizzle(c.env.lingshu_db)
  const payload = c.get('jwtPayload') as JwtPayload | undefined

  if (!payload?.id) {
    return c.json(errorResponse('未授权:请先登录'), 401)
  }

  const body = await c.req.json().catch(() => null)
  if (!body) {
    return c.json(errorResponse('请求体为空'), 400)
  }

  const { datetime } = body
  if (!datetime?.date || !datetime?.time) {
    return c.json(errorResponse('缺少必要参数：datetime'), 400)
  }

  const createdAt = Number(body.createdAt || Date.now())
  const now = Date.now()

  try {
    const inserted = await db
      .insert(daliurenCases)
      .values({
        userId: payload.id,
        name: (body.name || '').trim() || null,
        note: body.note || null,
        subject: body.subject || null,
        eventDate: datetime.date,
        eventTime: datetime.time,
        calendar: body.calendar || null,
        timeMode: body.timeMode || null,
        manualMode: body.manualMode ? 1 : 0,
        pillars: body.pillars ? JSON.stringify(body.pillars) : null,
        options: body.options ? JSON.stringify(body.options) : null,
        result: body.result ? JSON.stringify(body.result) : null,
        createdAt,
        updatedAt: now
      })
      .returning()

    const newId = inserted?.[0]?.id
    return c.json(successResponse({ id: String(newId) }, '保存成功'))
  } catch (error: any) {
    console.error('[DALUIREN CASE CREATE ERROR]', error)
    return c.json(errorResponse('保存失败，请稍后重试'), 500)
  }
})

daliurenCaseRouter.get('/', async (c) => {
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
      .from(daliurenCases)
      .where(eq(daliurenCases.userId, payload.id))
      .orderBy(desc(daliurenCases.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    const records = rows.map((row) => ({
      id: String(row.id),
      name: row.name || '',
      subject: row.subject || '',
      eventDate: row.eventDate || '',
      eventTime: row.eventTime || '',
      createdAt: Number(row.createdAt || Date.now()),
      note: row.note || undefined
    }))

    return c.json(successResponse({ count: records.length, limit, offset, records }))
  } catch (error: any) {
    console.error('[DALUIREN CASE LIST ERROR]', error)
    return c.json(errorResponse('查询失败，请稍后重试'), 500)
  }
})

daliurenCaseRouter.get('/:id', async (c) => {
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
      .from(daliurenCases)
      .where(and(eq(daliurenCases.userId, payload.id), eq(daliurenCases.id, caseId)))
      .get()

    if (!row) {
      return c.json(errorResponse('案例不存在'), 404)
    }

    const pillars = row.pillars ? JSON.parse(row.pillars) : null
    const options = row.options ? JSON.parse(row.options) : null
    const result = row.result ? JSON.parse(row.result) : null

    return c.json(successResponse({
      id: String(row.id),
      name: row.name || '',
      note: row.note || undefined,
      subject: row.subject || undefined,
      datetime: {
        date: row.eventDate || '',
        time: row.eventTime || ''
      },
      calendar: row.calendar || undefined,
      timeMode: row.timeMode || undefined,
      manualMode: Boolean(row.manualMode),
      pillars,
      options,
      result,
      createdAt: Number(row.createdAt || Date.now())
    }))
  } catch (error: any) {
    console.error('[DALUIREN CASE DETAIL ERROR]', error)
    return c.json(errorResponse('查询失败，请稍后重试'), 500)
  }
})

daliurenCaseRouter.delete('/:id', async (c) => {
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
      .select({ id: daliurenCases.id })
      .from(daliurenCases)
      .where(and(eq(daliurenCases.userId, payload.id), eq(daliurenCases.id, caseId)))
      .get()

    if (!existing) {
      return c.json(errorResponse('案例不存在或已删除'), 404)
    }

    await db
      .delete(daliurenCases)
      .where(and(eq(daliurenCases.userId, payload.id), eq(daliurenCases.id, caseId)))
      .run()

    return c.json(successResponse({ success: true }, '删除成功'))
  } catch (error: any) {
    console.error('[DALUIREN CASE DELETE ERROR]', error)
    return c.json(errorResponse('删除失败，请稍后重试'), 500)
  }
})

daliurenCaseRouter.put('/:id', async (c) => {
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

  const { datetime } = body
  if (!datetime?.date || !datetime?.time) {
    return c.json(errorResponse('缺少必要参数：datetime'), 400)
  }

  const now = Date.now()

  try {
    const result = await db
      .update(daliurenCases)
      .set({
        name: (body.name || '').trim() || null,
        note: body.note || null,
        subject: body.subject || null,
        eventDate: datetime.date,
        eventTime: datetime.time,
        calendar: body.calendar || null,
        timeMode: body.timeMode || null,
        manualMode: body.manualMode ? 1 : 0,
        pillars: body.pillars ? JSON.stringify(body.pillars) : null,
        options: body.options ? JSON.stringify(body.options) : null,
        result: body.result ? JSON.stringify(body.result) : null,
        updatedAt: now
      })
      .where(and(eq(daliurenCases.userId, payload.id), eq(daliurenCases.id, caseId)))
      .run()

    const changes = (result as { changes?: number } | undefined)?.changes ?? 0
    if (changes <= 0) {
      return c.json(errorResponse('案例不存在或无更新'), 404)
    }

    return c.json(successResponse({ success: true }, '更新成功'))
  } catch (error: any) {
    console.error('[DALUIREN CASE UPDATE ERROR]', error)
    return c.json(errorResponse('更新失败，请稍后重试'), 500)
  }
})
