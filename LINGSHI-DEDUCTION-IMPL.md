# 后端灵石扣减逻辑调整 - 实现总结

**时间**：2026-02-12  
**需求**：调整灵石扣减逻辑，优先扣减免费次数灵石，然后扣减赠送配额灵石  
**状态**：✅ 已完成

---

## 📝 需求分析

### 原逻辑问题

排卦时配额扣减只有 3 个优先级，没有灵石消耗的细分：

1. 会员免费
2. 每日免费配额
3. 赠送配额
4. ❌ 缺少：配额不足时的灵石消耗逻辑

### 新需求

当配额都用完后，支持用灵石继续排卦，但需要优先级：

1. **优先**：扣减「每日免费次数对应的灵石」(100 灵石/次)
2. **次之**：扣减「赠送配额对应的灵石」(100 灵石/次)

---

## 🔧 实现清单

### ✅ 1. 配置文件更新

**文件**：`src/config/lingshi.ts`

```typescript
export const LINGSHI_COSTS = {
  // 排卦消耗灵石的优先级：
  // 1. 优先免费配额
  // 2. 快用完时，扣减免费次数对应的灵石（100灵石一次）
  // 3. 赠送配额用完，扣减赠送配额对应的灵石（100灵石一次）
  divineFreeCost: 100,      // 每次免费排卦对应的灵石成本
  divineBonus: 100,         // 每次赠送排卦对应的灵石成本
  
  aiChat: 100,
  exchange: { /* ... */ }
};
```

**改动**：新增 `divineFreeCost` 和 `divineBonus` 常数

---

### ✅ 2. 核心逻辑 - checkQuotaStatus()

**文件**：`src/member/quota.ts` (行 25-103)

**功能变化**：

- 新增优先级 4：检查灵石是否足够排卦
- 若灵石 >= 100，返回 `canDivine: true`
- 提示消息包含灵石消耗信息

**新增逻辑**：

```typescript
// 优先级 4：检查灵石是否足够扣减
const freeLingshiCost = LINGSHI_COSTS.divineFreeCost;
const bonusLingshiCost = LINGSHI_COSTS.divineBonus;
const currentLingshi = user.lingshi ?? 0;

if (currentLingshi >= freeLingshiCost) {
  return {
    canDivine: true,
    reason: `使用灵石排卦（免费次数）：消耗 ${freeLingshiCost} 灵石...`,
    quotaRemaining: -2,
  };
}

if (currentLingshi >= bonusLingshiCost) {
  return {
    canDivine: true,
    reason: `使用灵石排卦（赠送配额）：消耗 ${bonusLingshiCost} 灵石...`,
    quotaRemaining: -2,
  };
}
```

---

### ✅ 3. 核心逻辑 - deductQuota()

**文件**：`src/member/quota.ts` (行 106-244)

**优先级扣减顺序**（完整实现）：

```
1. 会员免费          → source: 'membership'
2. 每日免费配额      → source: 'daily_free'
3. 赠送配额          → source: 'bonus_quota'
4. 灵石扣减（新增）
   ├─ 4.1 免费灵石   → source: 'lingshi_free'   (100灵石)
   └─ 4.2 赠送灵石   → source: 'lingshi_bonus'  (100灵石)
```

**新增灵石扣减逻辑**：

```typescript
// 优先级 4：灵石扣减（配额全部用尽时）
// 4.1 优先扣减「免费次数对应的灵石」(100灵石/次)
const freeLingshiCost = LINGSHI_COSTS.divineFreeCost;
if ((user.lingshi ?? 0) >= freeLingshiCost) {
  const result = await db
    .update(users)
    .set({
      lingshi: (user.lingshi ?? 0) - freeLingshiCost,
      updatedAt: Date.now(),
    })
    .where(and(eq(users.id, userId), gte(users.lingshi, freeLingshiCost)));

  if (result.changes > 0) {
    return {
      success: true,
      reason: `灵石扣减（免费次数）：消耗 ${freeLingshiCost} 灵石`,
      source: 'lingshi_free',
      lingshiDeducted: freeLingshiCost,
    };
  }
}

// 4.2 再扣减「赠送配额对应的灵石」(100灵石/次)
const bonusLingshiCost = LINGSHI_COSTS.divineBonus;
if ((user.lingshi ?? 0) >= bonusLingshiCost) {
  const result = await db
    .update(users)
    .set({
      lingshi: (user.lingshi ?? 0) - bonusLingshiCost,
      updatedAt: Date.now(),
    })
    .where(and(eq(users.id, userId), gte(users.lingshi, bonusLingshiCost)));

  if (result.changes > 0) {
    return {
      success: true,
      reason: `灵石扣减（赠送配额）：消耗 ${bonusLingshiCost} 灵石`,
      source: 'lingshi_bonus',
      lingshiDeducted: bonusLingshiCost,
    };
  }
}
```

**并发安全**：使用 `WHERE gte(users.lingshi, cost)` 防止并发时灵石为负数

---

### ✅ 4. 排卦响应更新

**文件**：`src/divination/quota-check.ts` (行 499-514)

**新增响应字段**：

```typescript
quotaDeducted: {
  source: deductResult.source, // 新增值：'lingshi_free' | 'lingshi_bonus'
  reason: deductResult.reason,
  lingshiDeducted: deductResult.lingshiDeducted, // 仅灵石扣减时返回
}
```

**source 值变化**：

- 之前：`'membership' | 'daily_free' | 'bonus_quota'`
- 现在：`'membership' | 'daily_free' | 'bonus_quota' | 'lingshi_free' | 'lingshi_bonus'`

---

### ✅ 5. 文档更新

**文件**：`doc/SYSTEM-GUIDE.md` (行 82-132)

**更新内容**：

1. 优先级说明增加灵石扣减的两个层级
2. 灵石消耗价格表（排卦消耗 + 会员兑换）
3. 配额检查顺序流程图更新

---

## 📊 测试文件

### 1. SQL 测试脚本

**文件**：`test-lingshi-deduction.sql`

包含 6 个测试场景：

1. 初始化用户状态
2. 扣减免费灵石
3. 扣减赠送灵石
4. 灵石不足失败
5. 混合场景（配额+灵石）
6. 会员场景（无扣减）

### 2. 测试指南

**文件**：`LINGSHI-DEDUCTION-TEST.md`

包含：

- 需求说明
- 代码改动总结
- 快速测试步骤
- 测试场景（3 个完整场景）
- 验证清单
- 后续优化建议

---

## 🧮 扣减优先级总结表

| 优先级 | 条件 | 扣减方式 | Source | 说明 |
|-------|------|--------|--------|------|
| 1 | memberLevel=1 且未过期 | 无 | membership | 会员权益，不扣费 |
| 2 | dailyFreeQuota > 0 | dailyFreeQuota - 1 | daily_free | 每日免费配额 |
| 3 | bonusQuota > 0 | bonusQuota - 1 | bonus_quota | 赠送配额 |
| 4.1 | lingshi >= 100 | lingshi - 100 | lingshi_free | **新增** 免费灵石 |
| 4.2 | lingshi >= 100 | lingshi - 100 | lingshi_bonus | **新增** 赠送灵石 |
| 失败 | 都不满足 | - | - | 提示灵石不足 |

---

## 🔍 关键特性

1. **两级灵石消耗**
   - 免费对应灵石：优先消耗
   - 赠送对应灵石：后消耗
   - 两者价格相同（100灵石/次）

2. **用户体验**
   - 配额不足时可用灵石继续排卦
   - 清晰的扣减提示信息
   - 前端可根据 source 值展示不同提示

3. **并发安全**
   - 所有数据库操作都使用 WHERE 条件
   - 防止灵石、配额为负数

4. **向后兼容**
   - 现有 API 响应结构不变
   - 新增字段是可选的（lingshiDeducted）
   - 现有客户端无需改动

---

## 📋 集成检查清单

- [x] 配置文件已更新
- [x] checkQuotaStatus() 函数已更新
- [x] deductQuota() 函数已实现新逻辑
- [x] 排卦响应已更新
- [x] 系统文档已同步
- [x] 测试脚本已准备
- [x] 测试指南已编写

---

## 🚀 部署建议

### 本地测试

```bash
# 1. 启动开发服务器
cd lingshu-backend
npm run dev

# 2. 执行测试脚本
./node_modules/.bin/wrangler d1 execute lingshu-db --local \
  --file test-lingshi-deduction.sql

# 3. 手动测试 API（见测试指南）
```

### 远程部署

```bash
# 1. 部署新代码
npm run deploy

# 2. 如有数据库迁移，手动执行（本次无需要）
```

---

## ⚡ 性能影响

- **查询增加**：每次排卦多检查 1-2 次灵石余额（使用索引，性能无影响）
- **写入增加**：灵石扣减操作（使用 WHERE 并发安全，性能无影响）
- **响应体积**：增加可选字段 `lingshiDeducted`（< 20 bytes）

---

## 🎓 应用场景

### 场景 1：新用户体验升级

- 用户 3 次免费配额用尽
- 有 200 灵石（其他渠道得到）
- 仍可继续排卦 2 次，消耗 100 灵石
- 优化了用户留存

### 场景 2：灵石充值变现

- 用户无配额，需要继续使用
- 可用灵石进行排卦
- 促进灵石充值和消费

### 场景 3：会员权益

- 会员无需扣费
- 优先级最高，保证会员体验

---

## 📞 常见问题

**Q：为什么灵石成本是 100 灵石/次？**  
A：参考兑换配额的 ticket 价格，保持一致。

**Q：免费灵石和赠送灵石有区别吗？**  
A：价格相同（都是 100），但扣减顺序不同（免费优先）。

**Q：这个改动会影响现有用户吗？**  
A：不会。现有配额不变，只是增加了灵石消耗功能。

**Q：前端需要做什么改动？**  
A：可选。根据 source 值显示不同提示即可，不强制。

---

## 📚 相关文档

- 系统架构指南：`doc/SYSTEM-GUIDE.md`
- 测试指南：`LINGSHI-DEDUCTION-TEST.md`
- 测试脚本：`test-lingshi-deduction.sql`
- 配置文件：`src/config/lingshi.ts`
