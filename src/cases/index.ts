/**
 * 卦例存储接口
 * - POST /api/cases: 保存卦例
 * - GET /api/cases: 列表
 * - GET /api/cases/:id: 详情
 * - DELETE /api/cases/:id: 删除
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq } from 'drizzle-orm';
import { cases } from '../schema';
import { errorResponse, successResponse } from '../utils/response';
import type { JwtPayload } from '../utils/types';

interface CloudflareBindings {
  lingshu_db: D1Database;
  JWT_SECRET: string;
}

export const caseRouter = new Hono<{ Bindings: CloudflareBindings }>();

caseRouter.post('/', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(errorResponse('未授权:请先登录'), 401);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json(errorResponse('请求体为空'), 400);
  }

  const { dateValue, timeValue, lines, ruleSetKey } = body;
  if (!dateValue || !timeValue || !Array.isArray(lines) || lines.length !== 6 || !ruleSetKey) {
    return c.json(errorResponse('缺少必要参数：dateValue/timeValue/lines/ruleSetKey'), 400);
  }

  const createdAt = Number(body.createdAt || Date.now());
  const now = Date.now();

  try {
    const inserted = await db
      .insert(cases)
      .values({
        userId: payload.id,
        dateValue,
        timeValue,
        ruleSetKey,
        question: (body.question || '').trim(),
        remark: body.remark || null,
        manualMode: body.manualMode ? 1 : 0,
        lines: JSON.stringify(lines),
        baseHexName: body.baseHexName || null,
        variantHexName: body.variantHexName || null,
        result: body.result ? JSON.stringify(body.result) : null,
        aiAnalysis: body.aiAnalysis || null,
        createdAt,
        updatedAt: now
      })
      .returning();

    const newId = inserted?.[0]?.id;
    return c.json(successResponse({ id: String(newId) }, '保存成功'));
  } catch (error: any) {
    console.error('[CASES CREATE ERROR]', error);
    return c.json(errorResponse('保存失败，请稍后重试'), 500);
  }
});

caseRouter.get('/', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(errorResponse('未授权：请先登录'), 401);
  }

  const limit = Number(c.req.query('limit') || 20);
  const offset = Number(c.req.query('offset') || 0);

  try {
    const rows = await db
      .select()
      .from(cases)
      .where(eq(cases.userId, payload.id))
      .orderBy(desc(cases.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    const records = rows.map((row) => ({
      id: String(row.id),
      dateValue: row.dateValue || '',
      timeValue: row.timeValue || '',
      question: row.question || '',
      remark: row.remark || undefined,
      createdAt: Number(row.createdAt || Date.now()),
      baseHexName: row.baseHexName || undefined,
      variantHexName: row.variantHexName || undefined
    }));

    return c.json(
      successResponse({
        count: records.length,
        limit,
        offset,
        records
      })
    );
  } catch (error: any) {
    console.error('[CASES LIST ERROR]', error);
    return c.json(errorResponse('查询失败，请稍后重试'), 500);
  }
});

caseRouter.get('/:id', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(errorResponse('未授权：请先登录'), 401);
  }

  const idParam = c.req.param('id');
  const caseId = Number(idParam);
  if (!caseId || Number.isNaN(caseId)) {
    return c.json(errorResponse('非法ID'), 400);
  }

  try {
    const row = await db
      .select()
      .from(cases)
      .where(and(eq(cases.userId, payload.id), eq(cases.id, caseId)))
      .get();

    if (!row) {
      return c.json(errorResponse('卦例不存在'), 404);
    }

    const lines = JSON.parse(row.lines || '[]');
    const result = row.result ? JSON.parse(row.result) : null;

    return c.json(
      successResponse({
        id: String(row.id),
        dateValue: row.dateValue,
        timeValue: row.timeValue,
        lines,
        ruleSetKey: row.ruleSetKey,
        question: row.question,
        remark: row.remark || undefined,
        manualMode: Boolean(row.manualMode),
        createdAt: Number(row.createdAt),
        baseHexName: row.baseHexName || undefined,
        variantHexName: row.variantHexName || undefined,
        result,
        aiAnalysis: row.aiAnalysis || undefined
      })
    );
  } catch (error: any) {
    console.error('[CASES DETAIL ERROR]', error);
    return c.json(errorResponse('查询失败，请稍后重试'), 500);
  }
});

caseRouter.delete('/:id', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(errorResponse('未授权：请先登录'), 401);
  }

  const idParam = c.req.param('id');
  const caseId = Number(idParam);
  if (!caseId || Number.isNaN(caseId)) {
    return c.json(errorResponse('非法ID'), 400);
  }

  try {
    const existing = await db
      .select({ id: cases.id })
      .from(cases)
      .where(and(eq(cases.userId, payload.id), eq(cases.id, caseId)))
      .get();

    if (!existing) {
      return c.json(errorResponse('卦例不存在或已删除'), 404);
    }

    await db
      .delete(cases)
      .where(and(eq(cases.userId, payload.id), eq(cases.id, caseId)))
      .run();

    return c.json(successResponse({ success: true }, '删除成功'));
  } catch (error: any) {
    console.error('[CASES DELETE ERROR]', error);
    return c.json(errorResponse('删除失败，请稍后重试'), 500);
  }
});
