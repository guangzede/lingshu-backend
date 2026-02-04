/**
 * 排卦业务模块：支持去重检查和配额扣减
 * Hash 包含：user_id + subject + category（避免不同问题被视为重复）
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gt } from 'drizzle-orm';
import { users, divinationRecords } from '../schema';
import { successResponse, errorResponse } from '../utils/response';
import { JwtPayload, QuotaCheckResult } from '../utils/types';
import { checkQuotaStatus, deductQuota } from '../member/quota';

interface CloudflareBindings {
  lingshu_db: D1Database;
  JWT_SECRET: string;
}

export const divinationRouter = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * 计算排卦去重的哈希值（使用 SubtleCrypto）
 * Hash = SHA256(userId + subject + category)
 * @param userId 用户ID
 * @param subject 问事内容/原因描述
 * @param category 问事类别（如：财运、婚姻、健康等）
 */
export async function calculateDivinationHash(
  userId: number,
  subject: string,
  category: string = 'default'
): Promise<string> {
  const hashInput = `${userId}:${subject}:${category}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(hashInput);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // 将 ArrayBuffer 转换为 hex 字符串
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 检查是否在 5 分钟内重复排卦（相同 hash）
 * 使用查询时过滤，而非后台定时清理，节省资源
 * @param db Drizzle 数据库实例
 * @param subjectHash 排卦哈希值
 */
export async function checkDuplicateDivination(db: any, subjectHash: string): Promise<boolean> {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  const duplicate = await db
    .select()
    .from(divinationRecords)
    .where(
      and(
        eq(divinationRecords.subjectHash, subjectHash),
        gt(divinationRecords.lastUsedAt, fiveMinutesAgo)
      )
    )
    .get();

  return !!duplicate;
}

/**
 * POST /api/divination/check-quota
 * 检查用户是否可以排卦
 * 请求体：{ subject, category? }
 * 返回：是否可以排卦 + 原因 + 是否重复
 */
divinationRouter.post('/check-quota', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(
      errorResponse('未授权：请先登录'),
      401
    );
  }

  const body = await c.req.json().catch(() => null);
  if (!body || !body.subject) {
    return c.json(
      errorResponse('缺少必要参数：subject'),
      400
    );
  }

  const { subject, category = 'default' } = body;
  const userId = payload.id;

  try {
    // 计算排卦哈希
    const subjectHash = await calculateDivinationHash(userId, subject, category);

    // 检查是否在 5 分钟内重复排卦
    const isDuplicate = await checkDuplicateDivination(db, subjectHash);

    // 检查配额状态
    const quotaStatus = await checkQuotaStatus(db, userId);

    const result: QuotaCheckResult = {
      canDivine: quotaStatus.canDivine && !isDuplicate,
      reason: isDuplicate
        ? '5分钟内已排过相同问题，请稍后再试'
        : quotaStatus.reason,
      isDuplicate,
      quotaRemaining: quotaStatus.quotaRemaining,
    };

    return c.json(successResponse(result));
  } catch (error: any) {
    console.error('[DIVINATION CHECK_QUOTA ERROR]', error);
    return c.json(
      errorResponse('检查失败，请稍后重试'),
      500
    );
  }
});

/**
 * POST /api/divination/divine
 * 执行排卦逻辑（消耗配额）
 * 请求体：{ subject, category?, inputData? }
 * 返回：排卦结果 + 配额扣减信息
 */
divinationRouter.post('/divine', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(
      errorResponse('未授权：请先登录'),
      401
    );
  }

  const body = await c.req.json().catch(() => null);
  if (!body || !body.subject) {
    return c.json(
      errorResponse('缺少必要参数：subject'),
      400
    );
  }

  const { subject, category = 'default', inputData } = body;
  const userId = payload.id;

  try {
    // 计算排卦哈希
    const subjectHash = await calculateDivinationHash(userId, subject, category);

    // 检查是否在 5 分钟内重复排卦
    const isDuplicate = await checkDuplicateDivination(db, subjectHash);

    if (isDuplicate) {
      return c.json(
        errorResponse('5分钟内已排过相同问题，请稍后再试'),
        400
      );
    }

    // 尝试扣减配额
    const deductResult = await deductQuota(db, userId);

    if (!deductResult.success) {
      return c.json(
        errorResponse(deductResult.reason),
        400
      );
    }

    // 记录排卦记录（用于5分钟去重检查）
    const now = Date.now();
    await db.insert(divinationRecords).values({
      userId,
      subjectHash,
      inputData: inputData ? JSON.stringify(inputData) : null,
      lastUsedAt: now,
      createdAt: now,
    });

    return c.json(
      successResponse(
        {
          success: true,
          quotaDeducted: {
            source: deductResult.source, // 'membership' | 'daily_free' | 'bonus_quota'
            reason: deductResult.reason,
          },
          // 实际的排卦结果由其他模块生成，这里只返回配额信息
          guaData: {
            status: 'pending',
            message: '排卦中...',
          },
        },
        '排卦成功，配额已扣减'
      )
    );
  } catch (error: any) {
    console.error('[DIVINATION DIVINE ERROR]', error);
    return c.json(
      errorResponse('排卦失败，请稍后重试'),
      500
    );
  }
});

/**
 * GET /api/divination/history
 * 查询当前用户的排卦历史（可选：按日期范围过滤）
 * 查询参数：limit? (默认10), offset? (默认0)
 */
divinationRouter.get('/history', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(
      errorResponse('未授权：请先登录'),
      401
    );
  }

  try {
    const limit = Number(c.req.query('limit') || 10);
    const offset = Number(c.req.query('offset') || 0);

    const records = await db
      .select()
      .from(divinationRecords)
      .where(eq(divinationRecords.userId, payload.id))
      .orderBy(divinationRecords.createdAt)
      .limit(limit)
      .offset(offset)
      .all();

    return c.json(
      successResponse({
        count: records.length,
        limit,
        offset,
        records,
      })
    );
  } catch (error: any) {
    console.error('[DIVINATION HISTORY ERROR]', error);
    return c.json(
      errorResponse('查询失败，请稍后重试'),
      500
    );
  }
});
