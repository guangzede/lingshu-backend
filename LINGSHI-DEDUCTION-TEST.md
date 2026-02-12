# 灵石扣减逻辑调整 - 测试指南

## 📋 需求说明

系统调整了排卦时灵石的扣减优先级，确保用户体验最优化：

**扣减优先级**（从高到低）：

```
1. 会员免费       → 无需扣费
2. 每日免费配额   → 扣减 dailyFreeQuota
3. 赠送配额       → 扣减 bonusQuota  
4. 灵石扣减（新增）
   └─ 4.1 优先扣「免费次数灵石」(100 灵石/次)
   └─ 4.2 再扣「赠送配额灵石」(100 灵石/次)
```

---

## 🔧 代码改动

### 文件 1: `src/config/lingshi.ts`

✅ 新增灵石成本常数：

- `divineFreeCost: 100` - 每次免费排卦对应的灵石成本
- `divineBonus: 100` - 每次赠送排卦对应的灵石成本

### 文件 2: `src/member/quota.ts`

#### 更新函数：`checkQuotaStatus()`

现在检查灵石是否足够继续排卦（优先级 4）

- 若灵石 >= 100，返回 `canDivine: true`
- 提示消息显示具体消耗灵石数量

#### 更新函数：`deductQuota()`

实现完整的 4 级优先级扣减：

1. ✅ 会员免费 → source: 'membership'
2. ✅ 每日免费 → source: 'daily_free'
3. ✅ 赠送配额 → source: 'bonus_quota'
4. ✨ **NEW** 灵石扣减两层级：
   - source: 'lingshi_free' (100 灵石)
   - source: 'lingshi_bonus' (100 灵石)

返回字段增加：`lingshiDeducted` (仅灵石扣减时返回)

### 文件 3: `src/divination/quota-check.ts`

✅ 更新响应注释，新增支持的 source 值

### 文件 4: `doc/SYSTEM-GUIDE.md`

✅ 更新系统文档，明确说明新的扣减优先级和价格

---

## 🧪 快速测试

### 前置环境

```bash
cd lingshu-backend
npm run dev
```

### 测试场景 1：配额全部用尽，用灵石排卦

1. **准备用户**：500 灵石 + 0 配额

   ```bash
   # 使用数据库工具或 wrangler d1 execute
   UPDATE users SET lingshi = 500, dailyFreeQuota = 0, bonusQuota = 0 
   WHERE id = 1
   ```

2. **第 1 次排卦**

   ```bash
   curl -X POST "http://localhost:8787/api/divination/divine" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"subject":"测试","category":"测试"}'
   ```

   **预期响应**：

   ```json
   {
     "code": 200,
     "data": {
       "quotaDeducted": {
         "source": "lingshi_free",
         "reason": "灵石扣减（免费次数）：消耗 100 灵石",
         "lingshiDeducted": 100
       }
     }
   }
   ```

   用户灵石：500 → 400

3. **第 2 次排卦**

   **预期响应**：

   ```json
   {
     "data": {
       "quotaDeducted": {
         "source": "lingshi_bonus",
         "reason": "灵石扣减（赠送配额）：消耗 100 灵石",
         "lingshiDeducted": 100
       }
     }
   }
   ```

   用户灵石：400 → 300

---

### 测试场景 2：灵石不足，排卦失败

1. **准备用户**：50 灵石 + 0 配额

   ```bash
   UPDATE users SET lingshi = 50, dailyFreeQuota = 0, bonusQuota = 0 
   WHERE id = 1
   ```

2. **尝试排卦**

   **预期响应**（400 错误）：

   ```json
   {
     "code": 400,
     "message": "配额已用尽，需要 100 灵石继续排卦，当前灵石：50"
   }
   ```

---

### 测试场景 3：检查配额状态

```bash
curl -X POST "http://localhost:8787/api/divination/check-quota" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subject":"测试","category":"测试"}'
```

**配额充足时**：

```json
{
  "canDivine": true,
  "reason": "使用灵石排卦（免费次数）：消耗 100 灵石，剩余 400"
}
```

**灵石不足时**：

```json
{
  "canDivine": false,
  "reason": "配额已用尽，需要 100 灵石继续排卦，当前灵石：50"
}
```

---

## ✅ 验证清单

- [x] 配额扣减优先级已更新
- [x] 灵石消耗有两个级别（免费/赠送）
- [x] 并发安全（使用 WHERE 条件防止负数）
- [x] 响应消息包含灵石扣减信息
- [x] 文档已同步更新

---

## 🎯 关键变更总结

| 变更 | 之前 | 之后 |
|------|------|------|
| 配额不足时 | 提示失败 | 检查灵石是否足够 |
| 灵石消耗等级 | 无 | 两级（免费/赠送） |
| 灵石成本 | 无 | 100 灵石/次 |
| 响应包含灵石信息 | 否 | 是（lingshiDeducted） |

---

## 📝 后续优化方向

- 可考虑根据用户等级/活跃度调整灵石成本
- 可添加"灵石包"充值功能
- 可在配额即将用尽时提前提醒用户
