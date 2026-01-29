/// <reference types="@cloudflare/workers-types" />

interface CloudflareBindings {
  lingshu_db: D1Database
  JWT_SECRET: string
}

// 使此文件成为模块
export {}
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt, sign } from 'hono/jwt'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, cases } from './schema'
import { compareSync, hashSync } from 'bcryptjs'
import type { CloudflareBindings } from '../worker-configuration'

const app = new Hono<{ Bindings: CloudflareBindings }>()

// 1. 开启跨域 (允许你的 React 前端访问)
app.use('/*', cors())

// 2. 注册接口
app.post('/auth/register', async (c) => {
  const db = drizzle(c.env.lingshu_db)
  // 获取前端传来的 JSON
  const body = await c.req.json().catch(() => null)
  if (!body || !body.phone || !body.password) {
    return c.json({ error: '缺少手机号或密码' }, 400)
  }

  const { phone, password } = body
  const hashedPassword = hashSync(password, 10) // 加密密码

  try {
    const result = await db.insert(users).values({
      phone,
      password: hashedPassword,
      vipExpire: 0
    }).returning()
    
    return c.json({ success: true, user: { id: result[0].id, phone: result[0].phone } })
  } catch (e) {
    return c.json({ error: '手机号已存在或系统错误' }, 400)
  }
})

// 3. 登录接口 (返回 Token)
app.post('/auth/login', async (c) => {
  const db = drizzle(c.env.lingshu_db)
  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: '参数错误' }, 400)

  const { phone, password } = body

  // 查库
  const user = await db.select().from(users).where(eq(users.phone, phone)).get()
  
  // 验证密码
  if (!user || !compareSync(password, user.password)) {
    return c.json({ error: '账号或密码错误' }, 401)
  }

  // 签发 Token (这就是你的 VIP 门票)
  // 注意：本地开发为了方便，密钥直接写死字符串，上线时再配置环境变量
  const secret = c.env.JWT_SECRET || 'dev_secret_key_123'
  const token = await sign({ id: user.id, vipExpire: user.vipExpire }, secret)
  
  return c.json({ success: true, token, vipExpire: user.vipExpire })
})

// --- 下面的接口都需要带 Token 才能访问 ---

// 4. 中间件 (保安) - 修复JWT配置
app.use('/api/*', async (c, next) => {
  const secret = c.env.JWT_SECRET || 'dev_secret_key_123'
  const jwtMiddleware = jwt({ 
    secret,
    alg: 'HS256' // 指定算法
  })
  return jwtMiddleware(c, next)
})

// 5. VIP 专属高级断语接口 (测试鉴权用)
app.get('/api/pro/interpretation', (c) => {
  const payload = c.get('jwtPayload') // 从 Token 里解出来的用户信息
  
  const isVip = payload.vipExpire > Date.now()
  
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