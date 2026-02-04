# 灵枢 App 后端登录与业务模块实现总结

## ✅ 已完成的工作清单

### 1. 数据库 Schema 扩展 ✓

**新增字段（users 表）：**
- `username` - 唯一登录账号（用户自定义）
- `dailyFreeQuota` - 每日免费排卦次数（默认1，新用户3=1daily+2bonus）
- `bonusQuota` - 赠送次数（上限5，达到上限后仅增加灵石）
- `lastUsedDate` - 上次使用日期（YYYYMMDD格式，用于重置判定）
- `lingshi` - 灵石余额
- `memberLevel` - 会员等级（0=非会员，1=会员）
- `memberExpireAt` - 会员过期时间戳（堆叠逻辑）
- `referrerId` - 推荐人ID
- `deviceId` - 设备指纹（风控降级方案）

**新增表：**
- `divinationRecords` - 排卦记录（用于5分钟去重）
- `referralRewards` - 分享奖励日志

**迁移文件：** `drizzle/0001_extended_schema.sql`

---

### 2. 认证模块实现 ✓

**文件：** `src/auth/index.ts`

**核心功能：**
- **登录即注册** - POST /auth/login
  - 若 username 不存在 → 自动创建新用户（dailyFreeQuota=1, bonusQuota=2）
  - 若 username 存在 → 验证 password，返回 token
  - 支持可选的 referrerId（用于推荐链接）和 deviceId（风控）
  
- **手机号绑定** - POST /auth/bind-phone
  - 将 phone 绑定到已有账户
  - 检查 phone 是否重复
  - 触发分享奖励闭环

**JWT Token：** 30天有效期，包含 id、username、memberLevel

---

### 3. 配额管理引擎 ✓

**文件：** `src/member/quota.ts`

**核心功能：**

1. **checkQuotaStatus()** - 检查用户排卦配额（优先级顺序）
   - 会员免费 (memberLevel=1 且未过期) → 直接放行
   - 每日免费 (dailyFreeQuota > 0) → 可用，显示剩余次数
   - 赠送配额 (bonusQuota > 0) → 可用
   - 都无 → 建议兑换灵石

2. **deductQuota()** - 扣减配额（并发安全）
   - 使用 `WHERE bonus_quota > 0` 防止负数
   - 返回扣减来源（membership/daily_free/bonus_quota）

3. **会员兑换** - POST /api/member/exchange
   - 周会员：700灵石 → 7天
   - 月会员：3000灵石 → 30天
   - 有效期堆叠：`max(now, currentExpireAt) + daysToAdd`

4. **配额状态查询** - GET /api/member/status
   - 返回完整配额信息

---

### 4. 分享奖励系统 ✓

**文件：** `src/member/referral.ts`

**核心功能：**

1. **分享闭环触发条件：**
   - 新用户完成 username 注册 ✓
   - 新用户绑定 phone ✓
   - 有推荐人ID (referrerId) ✓

2. **双向奖励：**
   - **新用户** → 已在注册时获得 3 次体验
   - **老用户** → 100灵石 + bonus_quota +1（上限5）

3. **奖励日志** - GET /api/referral/rewards
   - 查询推荐历史
   - 统计总推荐人数、灵石、配额

---

### 5. 排卦业务模块 ✓

**文件：** `src/divination/quota-check.ts`

**核心功能：**

1. **排卦去重机制**
   - 哈希值：SHA256(userId + subject + category)
   - 5分钟内相同问题不重复扣费
   - 使用 SubtleCrypto Web API（支持 Cloudflare Workers）

2. **排卦前检查** - POST /api/divination/check-quota
   - 检查是否重复
   - 检查配额状态
   - 返回：canDivine, isDuplicate, reason

3. **执行排卦** - POST /api/divination/divine
   - 验证配额
   - 扣减配额
   - 记录排卦历史
   - 支持 inputData 脱敏存储

4. **排卦历史** - GET /api/divination/history
   - 分页查询用户排卦记录

---

### 6. 工具函数与类型 ✓

**响应格式统一 (src/utils/response.ts)：**
```json
成功: { code: 200, message: "...", data: {...} }
错误: { code: 400|401|403|500, message: "..." }
```

**时间处理：**
- `getTodayDate()` - 返回 UTC+8 的 YYYYMMDD
- `isNewDay()` - 判定是否新的一天（用于配额重置）

**隐敏处理：**
- `maskPhone()` - 手机号隐敏 189****1234

---

### 7. 集成测试文档 ✓

**文件：** `TEST-INTEGRATION.md`

**涵盖场景：**
1. ✓ 新用户登录注册
2. ✓ 手机号绑定
3. ✓ 配额查询
4. ✓ 排卦检查与去重
5. ✓ 排卦执行（配额扣减）
6. ✓ 灵石兑换会员
7. ✓ 分享推荐奖励
8. ✓ 排卦历史
9. ✓ 错误处理与边界条件
10. ✓ 完整流程脚本

**测试方式：** cURL / Postman (无需特殊工具)

---

### 8. 系统架构文档 ✓

**文件：** `SYSTEM-GUIDE.md`

**内容：**
- API 快速导航表
- 核心业务逻辑流程
- 数据库表结构详解
- 并发安全性说明
- 常见测试场景
- 本地开发与部署指南

---

## 🏗️ 最终项目结构

```
src/
├── index.ts                          # 主应用 (路由集成)
├── schema.ts                         # ORM Schema (已扩展)
├── auth/
│   └── index.ts                      # 认证模块 ✓
├── member/
│   ├── quota.ts                      # 配额引擎 ✓
│   └── referral.ts                   # 分享奖励 ✓
├── divination/
│   └── quota-check.ts                # 排卦业务 ✓
└── utils/
    ├── types.ts                      # TypeScript 类型
    └── response.ts                   # 响应工具

drizzle/
├── 0001_extended_schema.sql          # Schema 迁移 ✓

文档/
├── TEST-INTEGRATION.md               # 集成测试 ✓
├── SYSTEM-GUIDE.md                   # 系统指南 ✓
└── README.md                         # 项目说明
```

---

## 🔐 关键特性实现

### ✓ 并发安全性
```typescript
// 防止负值扣减
UPDATE users SET bonus_quota = bonus_quota - 1
WHERE id = ? AND bonus_quota > 0
```

### ✓ 会员有效期堆叠
```typescript
newExpireAt = max(now, currentExpireAt) + daysToAdd
// 重复兑换时有效期顺延而非覆盖
```

### ✓ 排卦去重（5分钟）
```typescript
// 5分钟内相同 hash 的排卦不重复扣费
WHERE lastUsedAt > (now - 300秒)
```

### ✓ 分享奖励闭环
```
新用户注册 + phone绑定 + referrerId存在
  ↓
自动触发双向奖励
  ├─ 新用户: 3次体验
  └─ 老用户: 100灵石 + bonus_quota
```

---

## 🚀 本地开发启动

```bash
# 1. 安装依赖
npm install

# 2. 应用数据库迁移
npx drizzle-kit push:sqlite

# 3. 启动开发服务器
npm run dev
# → http://localhost:8787

# 4. 测试 API
curl http://localhost:8787/
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test@123",
    "phone": "18900001234"
  }'
```

---

## 📝 部署到生产环境

```bash
# 1. 更新 wrangler.toml
#  - 设置真实的数据库 ID
#  - JWT_SECRET 改为强密钥

# 2. 部署
npm run deploy

# 3. 绑定 D1 数据库
wrangler d1 execute lingshu-db --remote --file=drizzle/0001_extended_schema.sql
```

---

## ⚠️ 重要注意事项

### 时区处理
- 统一使用 **UTC+8（北京时间）** 计算每日配额重置
- 符合玄学用户的干支历法习惯（子时更替）

### 数据一致性
- 分享奖励、配额扣减都使用数据库事务保护
- 并发场景下使用 WHERE 条件防止负值

### 安全性
- 密码使用 bcryptjs (hash 强度 10)
- JWT Token 30天有效期
- Phone 隐敏处理 (189****1234)
- DeviceID 用于风控降级方案

### 性能优化
- divinationRecords 建立索引（user_id, subject_hash）
- 5分钟去重使用查询时过滤（不需要后台清理 cron）

---

## 📞 技术栈确认

- **框架：** Hono.js v4.11.7
- **运行时：** Cloudflare Workers (Edge)
- **数据库：** SQLite via D1
- **ORM：** Drizzle ORM v0.45.1
- **认证：** JWT HS256
- **加密：** bcryptjs
- **哈希：** SubtleCrypto (Web API)

---

## 🎯 下一步建议

1. **数据库迁移** → 执行 `drizzle/0001_extended_schema.sql`
2. **本地测试** → 参考 `TEST-INTEGRATION.md` 的脚本
3. **集成排卦算法** → 在 `/api/divination/divine` 中扩展卦象生成逻辑
4. **前端适配** → 按 `SYSTEM-GUIDE.md` 的 API 文档调用
5. **上线部署** → 更新 `wrangler.toml` 配置后部署

---

**版本：** 1.0.0  
**完成日期：** 2026-02-04  
**状态：** ✅ 可用
