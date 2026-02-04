/**
 * 认证模块：支持 username 登录即注册 + phone 绑定
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { sign } from 'hono/jwt';
import { eq, and } from 'drizzle-orm';
import { hashSync, compareSync } from 'bcryptjs';
import { users } from '../schema';
import { successResponse, errorResponse, maskPhone, getTodayDate } from '../utils/response';
import { ApiResponse, JwtPayload } from '../utils/types';

interface CloudflareBindings {
  lingshu_db: D1Database;
  JWT_SECRET: string;
}

export const authRouter = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * POST /auth/login
 * 登录即注册逻辑：
 * - 若 username 不存在，自动创建新用户（daily_free_quota=1, bonus_quota=2, lingshi=0）
 * - 若 username 存在，验证 password 并返回 token
 */
authRouter.post('/login', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const body = await c.req.json().catch(() => null);

  if (!body || !body.username || !body.password || !body.phone) {
    return c.json(
      errorResponse('缺少必要参数：username、password、phone'),
      400
    );
  }

  const { username, password, phone, referrerId, deviceId } = body;

  try {
    console.log('[AUTH LOGIN] 尝试登录:', { username, phone });
    
    // 检查用户是否存在
    let user = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .get();
    
    console.log('[AUTH LOGIN] 查询用户结果:', user ? '用户存在' : '用户不存在');

    // 若用户不存在，则自动创建（登录即注册）
    if (!user) {
      // 检查 phone 是否已被其他账户绑定
      const phoneExists = await db
        .select()
        .from(users)
        .where(eq(users.phone, phone))
        .get();
      
      console.log('[AUTH LOGIN] 手机号检查:', phoneExists ? '已被使用' : '可用');

      if (phoneExists) {
        return c.json(
          errorResponse('该手机号已被使用，请使用其他手机号'),
          400
        );
      }

      const hashedPassword = hashSync(password, 10);
      const now = Date.now();
      const today = getTodayDate();

      // 创建新用户，初始化配额
      const result = await db
        .insert(users)
        .values({
          username,
          phone,
          password: hashedPassword,
          dailyFreeQuota: 1,
          bonusQuota: 2, // 新用户注册当天赠送 2 次（加上 1 次免费 = 3 次）
          lastUsedDate: today,
          lingshi: 0,
          memberLevel: 0,
          memberExpireAt: 0,
          referrerId: referrerId || undefined,
          deviceId: deviceId || undefined,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      user = result[0];
    } else {
      // 用户存在，验证密码
      if (!compareSync(password, user.password)) {
        return c.json(
          errorResponse('用户名或密码错误'),
          401
        );
      }

      // 若 phone 与当前用户不匹配，不允许登录
      if (user.phone !== phone) {
        return c.json(
          errorResponse('用户名和手机号不匹配'),
          401
        );
      }
    }

    // 签发 JWT Token（30天有效期）
    const secret = c.env.JWT_SECRET || 'dev_secret_key_123';
    const payload: JwtPayload = {
      id: user.id,
      username: user.username,
      memberLevel: user.memberLevel,
    };
    const token = await sign(payload, secret, 'HS256');

    // 返回成功响应
    return c.json(
      successResponse(
        {
          token,
          user: {
            id: user.id,
            username: user.username,
            phone: maskPhone(user.phone),
            memberLevel: user.memberLevel,
            memberExpireAt: user.memberExpireAt,
            lingshi: user.lingshi,
            dailyFreeQuota: user.dailyFreeQuota,
            bonusQuota: user.bonusQuota,
          },
        },
        '登录成功'
      )
    );
  } catch (error: any) {
    console.error('[AUTH LOGIN ERROR]', error);
    return c.json(
      errorResponse('登录失败，请稍后重试'),
      500
    );
  }
});

/**
 * POST /auth/bind-phone
 * 绑定手机号到现有账户
 * 需要 JWT Token 认证
 */
authRouter.post('/bind-phone', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(
      errorResponse('未授权：请先登录'),
      401
    );
  }

  const body = await c.req.json().catch(() => null);
  if (!body || !body.phone) {
    return c.json(
      errorResponse('缺少必要参数：phone'),
      400
    );
  }

  const { phone } = body;
  const userId = payload.id;

  try {
    // 检查新手机号是否已被其他用户绑定
    const existingUser = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.phone, phone),
          // 排除当前用户
          (qb) => qb.where((col) => col.ne(users.id, userId))
        )
      )
      .get();

    if (existingUser) {
      return c.json(
        errorResponse('该手机号已被其他用户使用'),
        400
      );
    }

    // 获取当前用户信息
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!currentUser) {
      return c.json(
        errorResponse('用户不存在'),
        404
      );
    }

    // 更新手机号
    await db
      .update(users)
      .set({
        phone,
        updatedAt: Date.now(),
      })
      .where(eq(users.id, userId));

    return c.json(
      successResponse(
        {
          phone: maskPhone(phone),
        },
        '手机号绑定成功'
      )
    );
  } catch (error: any) {
    console.error('[AUTH BIND_PHONE ERROR]', error);
    return c.json(
      errorResponse('手机号绑定失败，请稍后重试'),
      500
    );
  }
});
