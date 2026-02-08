import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, cases } from './schema'
import { authRouter } from './auth'
import { memberRouter } from './member/quota'
import { divinationRouter } from './divination/quota-check'
import { aiRouter } from './ai'
import { datetime } from 'drizzle-orm/mysql-core'

// 定义环境类型
type Bindings = {
  lingshu_db: D1Database
  JWT_SECRET: string
  AI_API_BASE?: string
  AI_API_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// 1. 开启跨域 (允许你的 React 前端访问)
app.use('/*', cors())

// 健康检查接口
app.get('/api/health', (c) => c.json({ ok: true, status: 'healthy', timestamp: new Date() }))

// 2. JWT 中间件 (为 /api/* 路由保护)
app.use('/api/*', (c, next) => {
  const path = c.req.path
  if (path.startsWith('/api/auth') || path === '/api/health' || path === '/api/divination/compute') {
    return next()
  }
  const secret = c.env.JWT_SECRET || 'dev_secret_key_123'
  const jwtMiddleware = jwt({ secret, alg: 'HS256' })
  return jwtMiddleware(c, next)
})

// 3. 挂载认证路由
app.route('/api/auth', authRouter)

// 会员与配额相关路由
app.route('/api/member', memberRouter)

// 排盘计算与配额路由
app.route('/api/divination', divinationRouter)

// AI 流式聊天接口
app.route('/api/ai', aiRouter)

// 4. VIP 专属高级断语接口 (测试鉴权用)
app.get('/api/pro/interpretation', (c) => {
  const payload = c.get('jwtPayload') // 从 Token 里解出来的用户信息
  
  const isVip = payload.memberExpireAt > Date.now()
  
  if (!isVip) {
    return c.json({ 
      isVip: false, 
      data: "基础断语：此卦为吉..." // 普通用户看这个
    })
  }

  return c.json({ 
    isVip: true,
    data: "【VIP机密】高级断语：官鬼持世，动而化进，旺上加旺..." // VIP 看这个
  })
})

export default app
