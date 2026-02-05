# 🚀 灵枢后端 - 快速开始指南

## 项目已完成功能清单

> ✅ 此项目包含**灵枢 App 后端的完整登录与业务模块实现**，根据 `src/doc/index.md` 的需求文档开发。

### 已实现模块

| 模块 | 文件位置 | 功能 | 状态 |
|------|---------|------|------|
| **认证** | `src/auth/index.ts` | 登录即注册、手机号绑定 | ✅ |
| **配额管理** | `src/member/quota.ts` | 会员判定、配额检查、灵石兑换 | ✅ |
| **分享奖励** | `src/member/referral.ts` | 推荐链接、双向奖励、闭环 | ✅ |
| **排卦业务** | `src/divination/quota-check.ts` | 去重、配额扣减、历史查询 | ✅ |
| **工具函数** | `src/utils/` | 响应格式、时间处理、隐敏 | ✅ |

---

## 📖 核心 API 概览

### 认证接口

```bash
# 登录即注册
POST /auth/login
{
  "username": "用户名",
  "password": "密码",
  "phone": "18900001234",
  "referrerId": 5,           # 可选：推荐人ID
  "deviceId": "device_..."   # 可选：设备指纹
}
→ { token, user }

# 绑定手机号（触发分享闭环）
POST /auth/bind-phone
Headers: Authorization: Bearer <token>
{ "phone": "18900005678" }
```

### 配额与会员接口

```bash
# 查询配额状态
GET /api/member/status
Headers: Authorization: Bearer <token>
→ { memberLevel, canDivine, dailyFreeQuota, bonusQuota, lingshi }

# 灵石兑换会员
POST /api/member/exchange
Headers: Authorization: Bearer <token>
{ "type": "weekly" }  # 'weekly' (700灵石) | 'monthly' (3000灵石)
```

### 排卦接口

```bash
# 排卦前检查
POST /api/divination/check-quota
Headers: Authorization: Bearer <token>
{ "subject": "财运如何", "category": "财运" }
→ { canDivine, isDuplicate, reason }

# 执行排卦（消耗配额）
POST /api/divination/divine
Headers: Authorization: Bearer <token>
{ "subject": "财运如何", "category": "财运", "inputData": {...} }
→ { success, quotaDeducted }

# 查询排卦历史
GET /api/divination/history?limit=10&offset=0
Headers: Authorization: Bearer <token>
```

### 推荐接口

```bash
# 查询推荐奖励
GET /api/referral/rewards
Headers: Authorization: Bearer <token>
→ { stats, records }
```

---

## 🔧 本地开发快速启动

### 1️⃣ 环境准备

```bash
# 克隆或进入项目目录
cd /Users/guangze/Desktop/code/lingshu-backend

# 安装依赖
npm install
```

### 2️⃣ 启动开发服务器

```bash
npm run dev
# ⎔ 启动成功时输出：
# [wrangler:info] Ready on http://localhost:8787
```

### 3️⃣ 测试 API

```bash
# 测试根路由
curl http://localhost:8787/

# 新用户登录（自动注册）
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user_'$(date +%s)'",
    "password": "Test@123456",
    "phone": "18900001234"
  }' | jq .
```

---

## 📚 完整文档参考

| 文档 | 描述 | 适合人群 |
|------|------|---------|
| **SYSTEM-GUIDE.md** | 系统架构、API、数据库设计 | 后端工程师 |
| **TEST-INTEGRATION.md** | 测试脚本、场景示例 | QA、测试工程师 |
| **IMPLEMENTATION-SUMMARY.md** | 实现清单、技术栈 | 项目经理、新人 |

---

## 🧪 常见测试场景

### 场景 1：完整新用户流程

```bash
# 1. 登录（自动创建账户，获得 3 次体验配额）
TOKEN=$(curl -s -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "password": "Test@123",
    "phone": "18900001234"
  }' | jq -r '.data.token')

# 2. 查看配额（1 daily + 2 bonus）
curl -s -X GET http://localhost:8787/api/member/status \
  -H "Authorization: Bearer $TOKEN" | jq '.data | {canDivine, dailyFreeQuota, bonusQuota}'

# 3. 排卦（扣减 1 次配额）
curl -s -X POST http://localhost:8787/api/divination/divine \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "subject": "财运如何",
    "category": "财运"
  }' | jq '.data.quotaDeducted'

# 4. 再查一次配额（应该是 0 daily + 2 bonus）
curl -s -X GET http://localhost:8787/api/member/status \
  -H "Authorization: Bearer $TOKEN" | jq '.data | {dailyFreeQuota, bonusQuota}'
```

### 场景 2：5分钟去重检查

```bash
# 第一次排卦（成功）
curl -s -X POST http://localhost:8787/api/divination/divine \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subject": "婚姻", "category": "感情"}' | jq .

# 立即再排同样问题（被拒绝 - isDuplicate=true）
curl -s -X POST http://localhost:8787/api/divination/check-quota \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subject": "婚姻", "category": "感情"}' | jq '.data | {isDuplicate}'

# 等待 5 分钟后重试（成功）
sleep 300
curl -s -X POST http://localhost:8787/api/divination/divine \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subject": "婚姻", "category": "感情"}' | jq .
```

### 场景 3：灵石兑换会员

```bash
# 注：需要先给用户充灵石（数据库操作）
# UPDATE users SET lingshi = 700 WHERE id = 1;

# 兑换周会员
curl -s -X POST http://localhost:8787/api/member/exchange \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type": "weekly"}' | jq '.data | {memberExpireAt, newLingshi}'

# 查看会员状态（isMember 应为 true）
curl -s -X GET http://localhost:8787/api/member/status \
  -H "Authorization: Bearer $TOKEN" | jq '.data | {isMember, memberExpireAt}'
```

---

## 🗂️ 文件结构说明

```
src/
├── index.ts                    # 路由集成：auth, member, divination
├── schema.ts                   # 数据库表定义（4个表）
│
├── auth/index.ts               # POST /auth/login, /auth/bind-phone
├── member/
│   ├── quota.ts                # 配额检查、扣减、兑换逻辑
│   └── referral.ts             # 推荐奖励、分享闭环
├── divination/
│   └── quota-check.ts          # 排卦去重、配额检查、历史
└── utils/
    ├── types.ts                # 接口定义
    └── response.ts             # 响应函数、时间处理
```

---

## 🔑 关键设计要点

### 1. 登录即注册
- username 不存在 → 自动创建（dailyFreeQuota=1, bonusQuota=2）
- username 存在 → 验证密码（phone 必须匹配）
- 支持推荐链接（referrerId）和设备指纹（deviceId）

### 2. 配额优先级
```
会员免费 (memberLevel=1 && expireAt > now)
  ↓ (如果不是会员)
每日免费 (dailyFreeQuota > 0, 新一天重置)
  ↓
赠送配额 (bonusQuota > 0, 上限5)
  ↓
配额耗尽 (建议兑换灵石)
```

### 3. 5分钟去重
- Hash = SHA256(userId + subject + category)
- 相同 hash 5分钟内不重复扣费
- 不同问题有不同 hash，不会被视为重复

### 4. 分享奖励闭环
```
新用户: username注册 + phone绑定 + referrerId存在
  ↓
自动触发:
  ├─ 新用户: 已获得3次体验
  └─ 推荐人: +100灵石, +1 bonus_quota (上限5)
```

### 5. 会员有效期堆叠
```javascript
newExpireAt = max(now, currentExpireAt) + daysToAdd
// 确保重复兑换时有效期顺延而非覆盖
```

---

## 🛠️ 开发工具与配置

| 工具 | 版本 | 用途 |
|------|------|------|
| Node.js | v18+ | 运行时 |
| Hono | v4.11.7 | Web框架 |
| Drizzle ORM | v0.45.1 | 数据库操作 |
| bcryptjs | v3.0.3 | 密码加密 |
| Cloudflare Workers | - | 部署平台 |

---

## ⚙️ 环境配置

### 本地开发 (`wrangler.toml`)

```toml
[vars]
JWT_SECRET = "dev_secret_key_123"

[[d1_databases]]
binding = "lingshu_db"
database_name = "lingshu-db"
```

### 上线部署

```toml
[env.production]
[env.production.vars]
JWT_SECRET = "生成强密钥：$(openssl rand -base64 32)"
```

---

## 🚀 部署到生产环境

```bash
# 1. 确保 wrangler.toml 配置正确
# 2. 确保有有效的 D1 数据库 ID
# 3. 执行迁移
wrangler d1 execute lingshu_db --remote --file=drizzle/0001_extended_schema.sql

# 4. 部署
npm run deploy
```

---

## 🐛 常见问题

### Q: 为什么新用户有 2 次 bonusQuota？
A: 首日体验策略 → 1 dailyFreeQuota + 2 bonusQuota = 3 次，提高首日体验。

### Q: 会员过期后配额如何处理？
A: 会员过期后，下一次排卦时自动按优先级检查免费配额。

### Q: 不同问题会被视为重复吗？
A: **不会**。Hash 包含 subject 和 category，不同问题有不同 hash。

### Q: bonusQuota 超过 5 上限后怎么办？
A: 达到上限后，分享成功仅增加 100 灵石，不再增加 bonusQuota。

### Q: 数据库迁移失败怎么办？
A: 检查 D1 数据库连接，确保 database_id 正确；或手动执行 SQL 脚本。

---

## 📞 技术支持

- 系统架构：查阅 `SYSTEM-GUIDE.md`
- API 测试：查阅 `TEST-INTEGRATION.md`
- 实现细节：查阅 `IMPLEMENTATION-SUMMARY.md`

---

**灵枢 App 后端 v1.0.0** ✨  
Ready for development & testing!
