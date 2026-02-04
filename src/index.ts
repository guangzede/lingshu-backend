/// <reference types="@cloudflare/workers-types" />

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { authRouter } from './auth'
import { memberRouter } from './member/quota'
import { referralRouter } from './member/referral'
import { divinationRouter } from './divination/quota-check'

// 定义 CloudflareBindings 接口
interface CloudflareBindings {
  lingshu_db: D1Database
  JWT_SECRET: string
}

// 使此文件成为模块
export {}

const app = new Hono<{ Bindings: CloudflareBindings }>()

// ========== 全局中间件 ==========

// 1. 跨域支持
app.use('/*', cors())

// 2. JWT 认证中间件（仅保护 /api/* 路由）
app.use('/api/*', async (c, next) => {
  const secret = c.env.JWT_SECRET || 'dev_secret_key_123'
  const jwtMiddleware = jwt({
    secret,
    alg: 'HS256'
  })
  return jwtMiddleware(c, next)
})

// ========== 路由注册 ==========

// 认证路由（/auth/login, /auth/bind-phone）
app.route('/auth', authRouter)

// 会员与配额路由（/api/member/*)
app.route('/api/member', memberRouter)

// 分享奖励路由（/api/referral/*)
app.route('/api/referral', referralRouter)

// 排卦业务路由（/api/divination/*)
app.route('/api/divination', divinationRouter)

// ========== 健康检查端点 ==========
app.get('/health', (c) => {
  return c.json({
    code: 200,
    message: '服务正常运行',
    timestamp: Date.now()
  })
})

// ========== 根路径 ==========
app.get('/', (c) => {
  return c.json({
    code: 200,
    message: '灵枢 App 后端 API',
    version: '1.0.0',
    endpoints: {
      auth: [
        'POST /auth/login',
        'POST /auth/bind-phone'
      ],
      member: [
        'POST /api/member/exchange',
        'GET /api/member/status'
      ],
      referral: [
        'GET /api/referral/rewards'
      ],
      divination: [
        'POST /api/divination/check-quota',
        'POST /api/divination/divine',
        'GET /api/divination/history'
      ]
    }
  })
})

export default app