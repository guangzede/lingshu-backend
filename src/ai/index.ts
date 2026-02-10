import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, gte } from 'drizzle-orm';
import { users } from '../schema';
import { LINGSHI_COSTS } from '../config/lingshi';
import { errorResponse } from '../utils/response';
import { JwtPayload } from '../utils/types';

interface CloudflareBindings {
  lingshu_db: D1Database;
  JWT_SECRET: string;
  AI_API_BASE?: string;
  AI_API_KEY?: string;
}

const DEFAULT_AI_BASE = 'https://liuyao-ai.guangzede530.workers.dev/v1/chat/completions';

export const aiRouter = new Hono<{ Bindings: CloudflareBindings }>();

aiRouter.post('/chat', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload | undefined;
  if (!payload || !payload.id) {
    return c.json(errorResponse('未授权：请先登录'), 401);
  }

  const rawBody = await c.req.text().catch(() => '');
  if (!rawBody) {
    return c.json(errorResponse('请求体为空'), 400);
  }
  let body: any = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json(errorResponse('请求体格式错误'), 400);
  }
  if (!body || !Array.isArray(body.messages)) {
    return c.json(errorResponse('缺少必要参数：messages'), 400);
  }

  const db = drizzle(c.env.lingshu_db);
  const user = await db.select().from(users).where(eq(users.id, payload.id)).get();
  if (!user) {
    return c.json(errorResponse('用户不存在'), 404);
  }
  // 更新下当前用户lingshi为20000，方便测试
  // await db.update(users).set({ lingshi: 20000, updatedAt: Date.now() }).where(eq(users.id, payload.id));

  if ((user.lingshi || 0) < LINGSHI_COSTS.aiChat) {
    return c.json(
      errorResponse(
        `灵石不足，需要 ${LINGSHI_COSTS.aiChat} 灵石，当前 ${user.lingshi || 0} 灵石`
      ),
      400
    );
  }

  const now = Date.now();
  const deductResult = await db
    .update(users)
    .set({
      lingshi: (user.lingshi || 0) - LINGSHI_COSTS.aiChat,
      updatedAt: now
    })
    .where(and(eq(users.id, payload.id), gte(users.lingshi, LINGSHI_COSTS.aiChat)));

  const deductChanges =
    (deductResult as { changes?: number } | undefined)?.changes ??
    (deductResult as { meta?: { changes?: number } } | undefined)?.meta?.changes ??
    0;

  if (deductChanges <= 0) {
    return c.json(errorResponse('灵石不足，扣减失败'), 400);
  }

  const upstreamUrl = 'https://liuyao-ai.guangzede530.workers.dev/v1/chat/completions';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (c.env.AI_API_KEY) {
    headers.Authorization = `Bearer ${c.env.AI_API_KEY}`;
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
  } catch (err) {
    await db
      .update(users)
      .set({ lingshi: (user.lingshi || 0) + LINGSHI_COSTS.aiChat, updatedAt: Date.now() })
      .where(eq(users.id, payload.id));
    return c.json(errorResponse('AI 服务暂不可用，请稍后再试'), 502);
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    await db
      .update(users)
      .set({ lingshi: (user.lingshi || 0) + LINGSHI_COSTS.aiChat, updatedAt: Date.now() })
      .where(eq(users.id, payload.id));

    const errorText = await upstreamRes.text().catch(() => '');
    return c.json(
      errorResponse(`AI 服务调用失败${errorText ? `: ${errorText}` : ''} upstreamRes:${upstreamRes}`),
      upstreamRes.status || 502
    );
  }

  const contentType = upstreamRes.headers.get('content-type') || 'text/event-stream';
  const responseHeaders = new Headers({
    'Content-Type': contentType,
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders
  });
});
