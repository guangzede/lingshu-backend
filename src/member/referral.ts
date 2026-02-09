/**
 * 分享奖励模块：处理推荐链接的闭环逻辑
 * 触发条件：新用户完成 username 注册 + bind-phone
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { users, referralRewards } from '../schema';
import { successResponse, errorResponse } from '../utils/response';
import { JwtPayload } from '../utils/types';

interface CloudflareBindings {
  lingshu_db: D1Database;
  JWT_SECRET: string;
}

export const referralRouter = new Hono<{ Bindings: CloudflareBindings }>();
import { LINGSHI_REWARDS } from '../config/lingshi';

/**
 * 触发分享奖励闭环
 * 检查：新用户是否同时完成 username 注册 + phone 绑定
 * 如果是，则：
 * - 新用户：已获得 3 次首日体验（2 bonus + 1 daily_free）
 * - 老用户：增加 100 灵石 + bonus_quota（上限5）
 *
 * @param db Drizzle 数据库实例
 * @param newUserId 新用户ID
 */
export async function triggerReferralReward(db: any, newUserId: number) {
  const now = Date.now();

  // 获取新用户信息
  const newUser = await db
    .select()
    .from(users)
    .where(eq(users.id, newUserId))
    .get();

  if (!newUser) {
    return {
      success: false,
      reason: '新用户不存在',
    };
  }

  // 检查新用户是否已绑定 phone（完成注册流程）
  if (!newUser.phone) {
    return {
      success: false,
      reason: '新用户未绑定 phone，闭环未触发',
    };
  }

  // 检查新用户是否有推荐人
  if (!newUser.referrerId) {
    return {
      success: false,
      reason: '新用户无推荐人，无需触发奖励',
    };
  }

  // 获取推荐人信息
  const referrer = await db
    .select()
    .from(users)
    .where(eq(users.id, newUser.referrerId))
    .get();

  if (!referrer) {
    return {
      success: false,
      reason: '推荐人不存在',
    };
  }

  try {
    // 计算老用户的奖励：100 灵石 + bonus_quota（上限5）
    const newLingshi = referrer.lingshi + LINGSHI_REWARDS.referral;
    let newBonusQuota = referrer.bonusQuota;
    let bonusQuotaAwarded = 0;

    if (referrer.bonusQuota < 5) {
      newBonusQuota = Math.min(referrer.bonusQuota + 1, 5);
      bonusQuotaAwarded = 1;
    }

    // 更新老用户信息
    await db
      .update(users)
      .set({
        lingshi: newLingshi,
        bonusQuota: newBonusQuota,
        updatedAt: now,
      })
      .where(eq(users.id, newUser.referrerId));

    // 记录分享奖励日志（双条记录：一条灵石，一条配额）
    // 灵石奖励记录
    await db.insert(referralRewards).values({
      referrerId: newUser.referrerId,
      inviteeId: newUserId,
      rewardType: 'lingshi',
      lingshiAwarded: LINGSHI_REWARDS.referral,
      bonusQuotaAwarded: 0,
      createdAt: now,
    });

    // 配额奖励记录（仅当有配额增加时）
    if (bonusQuotaAwarded > 0) {
      await db.insert(referralRewards).values({
        referrerId: newUser.referrerId,
        inviteeId: newUserId,
        rewardType: 'bonus_quota',
        lingshiAwarded: 0,
        bonusQuotaAwarded: bonusQuotaAwarded,
        createdAt: now,
      });
    }

    return {
      success: true,
      reason: '分享奖励闭环已触发',
      referrerReward: {
        lingshiAwarded: LINGSHI_REWARDS.referral,
        bonusQuotaAwarded: bonusQuotaAwarded,
        newLingshi,
        newBonusQuota,
      },
    };
  } catch (error: any) {
    console.error('[REFERRAL REWARD TRIGGER ERROR]', error);
    return {
      success: false,
      reason: '分享奖励处理失败',
      error: error.message,
    };
  }
}

/**
 * POST /api/referral/rewards
 * 查询当前用户的推荐奖励历史
 */
referralRouter.get('/rewards', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(
      errorResponse('未授权：请先登录'),
      401
    );
  }

  try {
    // 查询作为推荐人的奖励记录
    const rewards = await db
      .select()
      .from(referralRewards)
      .where(eq(referralRewards.referrerId, payload.id))
      .all();

    // 统计数据
    const stats = {
      totalInvitees: new Set(rewards.map((r) => r.inviteeId)).size,
      totalLingshiAwarded: rewards.reduce((sum, r) => sum + (r.lingshiAwarded || 0), 0),
      totalBonusQuotaAwarded: rewards.reduce((sum, r) => sum + (r.bonusQuotaAwarded || 0), 0),
    };

    return c.json(
      successResponse({
        stats,
        records: rewards,
      })
    );
  } catch (error: any) {
    console.error('[REFERRAL REWARDS ERROR]', error);
    return c.json(
      errorResponse('查询失败，请稍后重试'),
      500
    );
  }
});
