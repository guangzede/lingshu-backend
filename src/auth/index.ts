/**
 * 认证模块：分离注册和登录
 * - POST /api/auth/register: 用户注册（username, password, phone）
 * - POST /api/auth/login: 用户登录（username, password）
 * - POST /api/auth/bind-phone: 绑定手机号
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

const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateInviteCode() {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    const idx = Math.floor(Math.random() * INVITE_CODE_ALPHABET.length);
    code += INVITE_CODE_ALPHABET[idx];
  }
  return code;
}

async function generateUniqueInviteCode(db: ReturnType<typeof drizzle>) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateInviteCode();
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.inviteCode, code))
      .get();
    if (!existing) return code;
  }
  throw new Error('邀请码生成失败');
}

/**
 * POST /api/auth/register
 * 用户注册
 * 参数：username, password, phone, referrerId(可选), deviceId(可选)
 * 返回：user 信息
 */
authRouter.post('/register', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  let body;

  try {
    body = await c.req.json().catch(() => null);
  } catch (parseError: any) {
    console.error('[AUTH REGISTER] JSON 解析失败:', parseError);
    return c.json(
      errorResponse('请求体格式错误'),
      400
    );
  }

  if (!body || !body.username || !body.password || !body.phone) {
    return c.json(
      errorResponse('缺少必要参数：username、password、phone'),
      400
    );
  }

  const { username, password, phone, referrerId, deviceId, inviteCode } = body;

  try {
    console.log('[AUTH REGISTER] 开始注册:', { username, phone });

    // 检查 username 是否已存在
    let existingUser;
    try {
      existingUser = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .get();
    } catch (dbError: any) {
      console.error('[AUTH REGISTER] 用户名查询失败:', dbError);
      return c.json(
        errorResponse('数据库连接失败，请稍后重试'),
        500
      );
    }

    if (existingUser) {
      console.warn('[AUTH REGISTER] 用户名已存在:', { username });
      return c.json(
        errorResponse('用户名已存在，请使用其他用户名'),
        400
      );
    }

    // 检查 phone 是否已存在
    let phoneExists;
    try {
      phoneExists = await db
        .select()
        .from(users)
        .where(eq(users.phone, phone))
        .get();
    } catch (dbError: any) {
      console.error('[AUTH REGISTER] 手机号查询失败:', dbError);
      return c.json(
        errorResponse('数据库连接失败，请稍后重试'),
        500
      );
    }

    if (phoneExists) {
      console.warn('[AUTH REGISTER] 手机号已存在:', { phone });
      return c.json(
        errorResponse('该手机号已被使用，请使用其他手机号'),
        400
      );
    }

    // 如果提供邀请码，校验并绑定推荐人
    let resolvedReferrerId = referrerId || undefined;
    if (inviteCode) {
      const referrer = await db
        .select()
        .from(users)
        .where(eq(users.inviteCode, inviteCode))
        .get();
      if (!referrer) {
        return c.json(
          errorResponse('邀请码无效'),
          400
        );
      }
      resolvedReferrerId = referrer.id;
    }

    // 创建新用户
    const hashedPassword = hashSync(password, 10);
    const now = Date.now();
    const today = getTodayDate();
    const generatedInviteCode = await generateUniqueInviteCode(db);

    try {
      const result = await db
        .insert(users)
        .values({
          username,
          phone,
          password: hashedPassword,
          dailyFreeQuota: 1,
          bonusQuota: 2,
          lastUsedDate: today,
          lingshi: 1000,
          memberLevel: 0,
          memberExpireAt: 0,
          referrerId: resolvedReferrerId,
          inviteCode: generatedInviteCode,
          deviceId: deviceId || undefined,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!result || result.length === 0) {
        console.error('[AUTH REGISTER] 用户创建失败：返回结果为空');
        return c.json(
          errorResponse('用户创建失败，请稍后重试'),
          500
        );
      }

      const newUser = result[0];
      console.log('[AUTH REGISTER] 用户注册成功:', { userId: newUser.id, username, createdAt: now });

      let token;
      try {
        const secret = c.env.JWT_SECRET || 'dev_secret_key_123';
        const payload: JwtPayload = {
          id: newUser.id,
          username: newUser.username,
          memberLevel: newUser.memberLevel || 0,
        };
        token = await sign(payload, secret, 'HS256');
      } catch (tokenError: any) {
        console.error('[AUTH REGISTER] Token 生成失败:', tokenError);
        return c.json(
          errorResponse('Token 生成失败，请稍后重试'),
          500
        );
      }

      return c.json(
        successResponse(
          {
            token,
            user: {
              id: newUser.id,
              username: newUser.username,
              phone: maskPhone(newUser.phone),
              inviteCode: newUser.inviteCode,
              nickname: newUser.nickname,
              gender: newUser.gender,
              birthday: newUser.birthday,
              memberPurchasedAt: newUser.memberPurchasedAt,
              profileCompletedAt: newUser.profileCompletedAt,
              memberLevel: newUser.memberLevel,
              memberExpireAt: newUser.memberExpireAt,
              lingshi: newUser.lingshi,
              dailyFreeQuota: newUser.dailyFreeQuota,
              bonusQuota: newUser.bonusQuota,
              createdAt: newUser.createdAt,
            },
          },
          '注册成功'
        )
      );
    } catch (insertError: any) {
      console.error('[AUTH REGISTER] 用户创建失败:', insertError);
      if (insertError.message && insertError.message.includes('UNIQUE')) {
        return c.json(
          errorResponse('用户名或手机号已存在'),
          400
        );
      }
      return c.json(
        errorResponse('用户创建失败，请稍后重试'),
        500
      );
    }
  } catch (error: any) {
    console.error('[AUTH REGISTER UNKNOWN ERROR]', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return c.json(
      errorResponse('注册失败，请稍后重试'),
      500
    );
  }
});

/**
 * POST /api/auth/login
 * 用户登录（仅需要 username 和 password）
 * 参数：username, password
 * 返回：token 和 user 信息
 */
authRouter.post('/login', async (c) => {
  const db = drizzle(c.env.lingshu_db);

  let body;

  try {
    body = await c.req.json().catch(() => null);
  } catch (parseError: any) {
    console.error('[AUTH LOGIN] JSON 解析失败:', parseError);
    return c.json(
      errorResponse('请求体格式错误'),
      400
    );
  }

  if (!body || !body.username || !body.password) {
    return c.json(
      errorResponse('缺少必要参数：username、password'),
      400
    );
  }

  const { username, password } = body;

  try {
    console.log('[AUTH LOGIN] 尝试登录:', { username });

    // 查询用户
    let user;
    try {
      user = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .get();
    } catch (dbError: any) {
      console.error('[AUTH LOGIN] 数据库查询失败:', dbError);
      return c.json(
        errorResponse('数据库连接失败，请稍后重试'),
        500
      );
    }

    // 用户不存在
    if (!user) {
      console.warn('[AUTH LOGIN] 用户不存在:', { username });
      return c.json(
        errorResponse('用户名或密码错误'),
        401
      );
    }

    // 验证密码
    if (!compareSync(password, user.password)) {
      console.warn('[AUTH LOGIN] 密码验证失败:', { username });
      return c.json(
        errorResponse('用户名或密码错误'),
        401
      );
    }

    console.log('[AUTH LOGIN] 用户登录成功:', { userId: user.id, username });

    // 签发 JWT Token
    let token;
    try {
      const secret = c.env.JWT_SECRET || 'dev_secret_key_123';
      const payload: JwtPayload = {
        id: user.id,
        username: user.username,
        memberLevel: user.memberLevel || 0,
      };
      token = await sign(payload, secret, 'HS256');
    } catch (tokenError: any) {
      console.error('[AUTH LOGIN] Token 生成失败:', tokenError);
      return c.json(
        errorResponse('Token 生成失败，请稍后重试'),
        500
      );
    }

    // 返回成功响应
    return c.json(
      successResponse(
        {
          token,
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
    console.error('[AUTH LOGIN UNKNOWN ERROR]', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return c.json(
      errorResponse('登录失败，请稍后重试'),
      500
    );
  }
});

/**
 * POST /api/auth/bind-phone
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

  let body;
  try {
    body = await c.req.json().catch(() => null);
  } catch (parseError: any) {
    console.error('[AUTH BIND_PHONE] JSON 解析失败:', parseError);
    return c.json(
      errorResponse('请求体格式错误'),
      400
    );
  }

  if (!body || !body.phone) {
    return c.json(
      errorResponse('缺少必要参数：phone'),
      400
    );
  }

  const { phone } = body;
  const userId = payload.id;

  try {
    console.log('[AUTH BIND_PHONE] 开始绑定手机号:', { userId, phone });

    // 检查新手机号是否已被其他用户绑定
    let existingUser;
    try {
      const allUsersWithPhone = await db
        .select()
        .from(users)
        .where(eq(users.phone, phone))
        .all();
      
      // 过滤掉当前用户
      existingUser = allUsersWithPhone.find(u => u.id !== userId);
    } catch (dbError: any) {
      console.error('[AUTH BIND_PHONE] 手机号检查失败:', dbError);
      return c.json(
        errorResponse('数据库连接失败，请稍后重试'),
        500
      );
    }

    if (existingUser) {
      console.warn('[AUTH BIND_PHONE] 手机号已被使用:', { phone, existingUserId: existingUser.id });
      return c.json(
        errorResponse('该手机号已被其他用户使用'),
        400
      );
    }

    // 获取当前用户信息
    let currentUser;
    try {
      currentUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .get();
    } catch (dbError: any) {
      console.error('[AUTH BIND_PHONE] 用户查询失败:', dbError);
      return c.json(
        errorResponse('数据库连接失败，请稍后重试'),
        500
      );
    }

    if (!currentUser) {
      console.warn('[AUTH BIND_PHONE] 用户不存在:', { userId });
      return c.json(
        errorResponse('用户不存在'),
        404
      );
    }

    // 更新手机号
    try {
      await db
        .update(users)
        .set({
          phone,
          updatedAt: Date.now(),
        })
        .where(eq(users.id, userId));

      console.log('[AUTH BIND_PHONE] 手机号绑定成功:', { userId, phone });

      return c.json(
        successResponse(
          {
            phone: maskPhone(phone),
          },
          '手机号绑定成功'
        )
      );
    } catch (updateError: any) {
      console.error('[AUTH BIND_PHONE] 手机号更新失败:', updateError);
      if (updateError.message && updateError.message.includes('UNIQUE')) {
        return c.json(
          errorResponse('该手机号已被使用'),
          400
        );
      }
      return c.json(
        errorResponse('手机号绑定失败，请稍后重试'),
        500
      );
    }
  } catch (error: any) {
    console.error('[AUTH BIND_PHONE UNKNOWN ERROR]', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return c.json(
      errorResponse('手机号绑定失败，请稍后重试'),
      500
    );
  }
});
