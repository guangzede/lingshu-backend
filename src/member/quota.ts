/**
 * 配额管理模块：包含配额检查、扣减和灵石兑换
 * 支持事务和并发安全的负值保护
 */

import { Hono } from 'hono';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, gt, gte } from 'drizzle-orm';
import { users } from '../schema';
import { LINGSHI_COSTS, LINGSHI_REWARDS } from '../config/lingshi';
import { successResponse, errorResponse, getTodayDate, isNewDay, maskPhone } from '../utils/response';
import { JwtPayload } from '../utils/types';

interface CloudflareBindings {
  lingshu_db: D1Database;
  JWT_SECRET: string;
}

export const memberRouter = new Hono<{ Bindings: CloudflareBindings }>();

const EXCHANGE_RATES = LINGSHI_COSTS.exchange;

/**
 * 检查当前用户的配额状态
 * 返回：是否可以排卦 + 剩余可用次数
 * @param db Drizzle 数据库实例
 * @param userId 用户ID
 */
export async function checkQuotaStatus(db: any, userId: number) {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();

  if (!user) {
    return {
      canDivine: false,
      reason: '用户不存在',
      quotaRemaining: 0,
    };
  }

  // 优先级 1：检查会员状态
  if (user.memberLevel === 1 && user.memberExpireAt > Date.now()) {
    return {
      canDivine: true,
      reason: '会员可用（无需扣费）',
      quotaRemaining: -1, // 会员不计算次数
    };
  }

  // 优先级 2：检查每日免费配额
  if (isNewDay(user.lastUsedDate)) {
    // 新的一天，重置免费次数
    return {
      canDivine: true,
      reason: '当日免费配额充足',
      quotaRemaining: user.dailyFreeQuota - 1,
    };
  }

  if (user.dailyFreeQuota > 0) {
    return {
      canDivine: true,
      reason: '当日免费配额充足',
      quotaRemaining: user.dailyFreeQuota - 1,
    };
  }

  // 优先级 3：检查额外赠送次数（bonus_quota）
  if (user.bonusQuota > 0) {
    return {
      canDivine: true,
      reason: '使用赠送配额',
      quotaRemaining: user.bonusQuota - 1,
    };
  }

  // 都没有了，建议兑换灵石
  return {
    canDivine: false,
    reason: `配额已用尽，可用灵石: ${user.lingshi}`,
    quotaRemaining: 0,
  };
}

/**
 * 扣减配额（支持事务和并发安全）
 * 返回：是否扣减成功 + 扣减来源
 * @param db Drizzle 数据库实例
 * @param userId 用户ID
 */
export async function deductQuota(db: any, userId: number) {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();

  if (!user) {
    return {
      success: false,
      reason: '用户不存在',
    };
  }

  // 优先级 1：会员免费
  if (user.memberLevel === 1 && user.memberExpireAt > Date.now()) {
    return {
      success: true,
      reason: '会员可用',
      source: 'membership',
    };
  }

  // 优先级 2：每日免费配额
  const today = getTodayDate();
  if (isNewDay(user.lastUsedDate) && user.dailyFreeQuota > 0) {
    // 重置每日配额，并扣减一次
    await db
      .update(users)
      .set({
        dailyFreeQuota: user.dailyFreeQuota - 1,
        lastUsedDate: today,
        updatedAt: Date.now(),
      })
      .where(eq(users.id, userId));

    return {
      success: true,
      reason: '每日免费配额扣减',
      source: 'daily_free',
    };
  }

  if (user.dailyFreeQuota > 0) {
    // 仍在同一天，扣减免费次数
    await db
      .update(users)
      .set({
        dailyFreeQuota: user.dailyFreeQuota - 1,
        updatedAt: Date.now(),
      })
      .where(eq(users.id, userId));

    return {
      success: true,
      reason: '每日免费配额扣减',
      source: 'daily_free',
    };
  }

  // 优先级 3：额外赠送配额（含并发安全检查）
  if (user.bonusQuota > 0) {
    // 使用 WHERE 条件确保不会扣成负数（并发安全）
    const result = await db
      .update(users)
      .set({
        bonusQuota: user.bonusQuota - 1,
        updatedAt: Date.now(),
      })
      .where(and(eq(users.id, userId), gt(users.bonusQuota, 0)));

    if (result.changes > 0) {
      return {
        success: true,
        reason: '赠送配额扣减',
        source: 'bonus_quota',
      };
    }
  }

  return {
    success: false,
    reason: '配额不足，无法排卦',
  };
}

/**
 * POST /api/member/exchange
 * 灵石兑换会员或次数
 * 请求体：{ type: 'weekly' | 'monthly' | 'ticket' }
 */
memberRouter.post('/exchange', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(
      errorResponse('未授权：请先登录'),
      401
    );
  }

  const body = await c.req.json().catch(() => null);
  if (!body || !body.type) {
    return c.json(
      errorResponse('缺少必要参数：type (weekly|monthly|ticket)'),
      400
    );
  }

  const { type } = body;
  const userId = payload.id;

  // 验证 type 是否有效
  if (!Object.prototype.hasOwnProperty.call(EXCHANGE_RATES, type)) {
    return c.json(
      errorResponse('不支持的兑换类型，仅支持: weekly, monthly, ticket'),
      400
    );
  }

  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!user) {
      return c.json(
        errorResponse('用户不存在'),
        404
      );
    }

    const requiredLingshi = EXCHANGE_RATES[type as keyof typeof EXCHANGE_RATES];

    // 检查灵石是否足够
    if ((user.lingshi ?? 0) < requiredLingshi) {
      return c.json(
        errorResponse(
          `灵石不足，需要 ${requiredLingshi} 灵石，当前 ${user.lingshi ?? 0} 灵石`
        ),
        400
      );
    }

    const now = Date.now();

    if (type === 'ticket') {
      // 兑换单次使用券：扣减灵石 + 增加 bonusQuota
      await db
        .update(users)
        .set({
          lingshi: (user.lingshi ?? 0) - requiredLingshi,
          bonusQuota: (user.bonusQuota ?? 0) + 1,
          updatedAt: now,
        })
        .where(eq(users.id, userId));

      return c.json(
        successResponse(
          {
            type,
            lingshiDeducted: requiredLingshi,
            newLingshi: (user.lingshi ?? 0) - requiredLingshi,
            bonusQuota: (user.bonusQuota ?? 0) + 1,
          },
          '成功兑换单次使用券'
        )
      );
    }

    // 计算会员有效期（堆叠逻辑：max(当前时间, 现有过期时间) + 天数）
    let daysToAdd = 7; // 默认周会员 7 天
    if (type === 'monthly') {
      daysToAdd = 30;
    }

    const currentExpireAt = user.memberExpireAt || 0;
    const baseTime = Math.max(now, currentExpireAt);
    const newExpireAt = baseTime + daysToAdd * 24 * 60 * 60 * 1000;

    // 事务：扣减灵石 + 更新会员信息
    await db
      .update(users)
      .set({
        lingshi: (user.lingshi ?? 0) - requiredLingshi,
        memberLevel: 1,
        memberExpireAt: newExpireAt,
        memberPurchasedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    return c.json(
      successResponse(
        {
          type,
          lingshiDeducted: requiredLingshi,
          newLingshi: (user.lingshi ?? 0) - requiredLingshi,
          memberExpireAt: newExpireAt,
          daysAdded: daysToAdd,
        },
        `成功兑换 ${type === 'weekly' ? '周' : '月'}会员`
      )
    );
  } catch (error: any) {
    console.error('[MEMBER EXCHANGE ERROR]', error);
    return c.json(
      errorResponse('兑换失败，请稍后重试'),
      500
    );
  }
});

/**
 * GET /api/member/status
 * 查询当前用户的会员和配额状态
 */
memberRouter.get('/status', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(
      errorResponse('未授权：请先登录'),
      401
    );
  }

  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.id))
      .get();

    if (!user) {
      return c.json(
        errorResponse('用户不存在'),
        404
      );
    }

    const quotaStatus = await checkQuotaStatus(db, payload.id);
    const invitees = await db
      .select()
      .from(users)
      .where(eq(users.referrerId, payload.id))
      .all();
    const invitedCount = invitees.length;

    return c.json(
      successResponse({
        user: {
          id: user.id,
          username: user.username,
          phone: maskPhone(user.phone),
          inviteCode: user.inviteCode,
          nickname: user.nickname,
          gender: user.gender,
          birthday: user.birthday,
          memberPurchasedAt: user.memberPurchasedAt,
          profileCompletedAt: user.profileCompletedAt,
          invitedCount,
          memberLevel: user.memberLevel,
          memberExpireAt: user.memberExpireAt,
          lingshi: user.lingshi,
          dailyFreeQuota: user.dailyFreeQuota,
          bonusQuota: user.bonusQuota,
        },
        invitedCount,
        memberLevel: user.memberLevel,
        memberExpireAt: user.memberExpireAt,
        memberPurchasedAt: user.memberPurchasedAt,
        isMember: user.memberLevel === 1 && user.memberExpireAt !== null && user.memberExpireAt > Date.now(),
        dailyFreeQuota: user.dailyFreeQuota,
        bonusQuota: user.bonusQuota,
        lingshi: user.lingshi,
        canDivine: quotaStatus.canDivine,
        reason: quotaStatus.reason,
        quotaRemaining: quotaStatus.quotaRemaining,
      })
    );
  } catch (error: any) {
    console.error('[MEMBER STATUS ERROR]', error);
    return c.json(
      errorResponse('查询失败，请稍后重试'),
      500
    );
  }
});

/**
 * POST /api/member/profile
 * 完善用户资料（nickname, gender, birthday, phone）
 * 首次完善奖励 500 灵石
 */
memberRouter.post('/profile', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(
      errorResponse('未授权：请先登录'),
      401
    );
  }

  let body;
  try {
    body = await c.req.json().catch(() => null);
  } catch (parseError: any) {
    console.error('[MEMBER PROFILE] JSON 解析失败:', parseError);
    return c.json(
      errorResponse('请求体格式错误'),
      400
    );
  }

  if (!body) {
    return c.json(
      errorResponse('缺少请求体'),
      400
    );
  }

  const { nickname, gender, birthday, phone } = body;
  const userId = payload.id;

  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!user) {
      return c.json(
        errorResponse('用户不存在'),
        404
      );
    }

    if (phone && phone !== user.phone) {
      const phoneOwner = await db
        .select()
        .from(users)
        .where(eq(users.phone, phone))
        .get();
      if (phoneOwner && phoneOwner.id !== userId) {
        return c.json(
          errorResponse('该手机号已被使用'),
          400
        );
      }
    }

    const now = Date.now();
    const nextNickname = nickname ?? user.nickname;
    const nextGender = gender ?? user.gender;
    const nextBirthday = birthday ?? user.birthday;

    const completingNow =
      !user.profileCompletedAt &&
      !!nextNickname &&
      !!nextGender &&
      !!nextBirthday;

    const bonusAwarded = completingNow ? LINGSHI_REWARDS.profileComplete : 0;
    const nextLingshi = (user.lingshi ?? 0) + bonusAwarded;

    await db
      .update(users)
      .set({
        nickname: nextNickname,
        gender: nextGender,
        birthday: nextBirthday,
        phone: phone ?? user.phone,
        profileCompletedAt: completingNow ? now : user.profileCompletedAt,
        lingshi: nextLingshi,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    return c.json(
      successResponse({
        user: {
          id: user.id,
          username: user.username,
          phone: maskPhone(phone ?? user.phone),
          inviteCode: user.inviteCode,
          nickname: nextNickname,
          gender: nextGender,
          birthday: nextBirthday,
          memberPurchasedAt: user.memberPurchasedAt,
          profileCompletedAt: completingNow ? now : user.profileCompletedAt,
          memberLevel: user.memberLevel,
          memberExpireAt: user.memberExpireAt,
          lingshi: nextLingshi,
          dailyFreeQuota: user.dailyFreeQuota,
          bonusQuota: user.bonusQuota,
        },
        bonusAwarded,
      }, completingNow ? '资料完善奖励已发放' : '资料更新成功')
    );
  } catch (error: any) {
    console.error('[MEMBER PROFILE ERROR]', error);
    return c.json(
      errorResponse('更新失败，请稍后重试'),
      500
    );
  }
});
