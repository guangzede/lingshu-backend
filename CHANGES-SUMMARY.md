## 后端灵石扣减逻辑调整 - 改动文件清单

📅 **完成时间**: 2026-02-12  
📝 **目的**: 优先扣减免费次数灵石，然后扣减赠送配额灵石

---

## 📂 修改的文件一览表

### 核心业务逻辑文件 (2 个)

| 文件 | 行数范围 | 改动摘要 |
|------|---------|--------|
| `src/config/lingshi.ts` | 全文 | 新增灵石成本常数：divineFreeCost, divineBonus |
| `src/member/quota.ts` | 25-244 | 更新 checkQuotaStatus 和 deductQuota，实现 4 级优先级 |

### API 响应更新 (1 个)

| 文件 | 行数范围 | 改动摘要 |
|------|---------|--------|
| `src/divination/quota-check.ts` | 499-514 | 更新排卦响应，包含新的 source 值和 lingshiDeducted 字段 |

### 文档更新 (1 个)

| 文件 | 行数范围 | 改动摘要 |
|------|---------|--------|
| `doc/SYSTEM-GUIDE.md` | 82-132 | 更新配额优先级说明和灵石消耗价格表 |

### 新增测试文件 (2 个)

| 文件 | 用途 |
|------|------|
| `test-lingshi-deduction.sql` | SQL 测试脚本，包含 6 个测试场景 |
| `LINGSHI-DEDUCTION-TEST.md` | 测试指南和快速开始 |

### 实现文档 (1 个)

| 文件 | 用途 |
|------|------|
| `LINGSHI-DEDUCTION-IMPL.md` | 详细实现总结和集成检查 |

---

## 🔄 改动详情

### 1️⃣ `src/config/lingshi.ts` (完全重写)

**新增**: 灵石消耗成本定义

```typescript
divineFreeCost: 100,      // 每次免费排卦对应的灵石成本
divineBonus: 100,         // 每次赠送排卦对应的灵石成本
```

---

### 2️⃣ `src/member/quota.ts` (两个函数更新)

#### 更新函数 A: `checkQuotaStatus()` (第 25-103 行)

**新增逻辑**: 优先级 4 - 灵石可用性检查

```typescript
// 优先级 4：检查灵石是否足够扣减
const freeLingshiCost = LINGSHI_COSTS.divineFreeCost;
const bonusLingshiCost = LINGSHI_COSTS.divineBonus;

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

#### 更新函数 B: `deductQuota()` (第 106-244 行)

**新增优先级**: 4.1 和 4.2

```typescript
// 优先级 4.1：免费灵石扣减（100灵石）
if ((user.lingshi ?? 0) >= freeLingshiCost) {
  // 更新数据库，返回 source: 'lingshi_free'
}

// 优先级 4.2：赠送灵石扣减（100灵石）  
if ((user.lingshi ?? 0) >= bonusLingshiCost) {
  // 更新数据库，返回 source: 'lingshi_bonus'
}
```

---

### 3️⃣ `src/divination/quota-check.ts` (第 499-514 行)

**更新响应结构**:

```typescript
quotaDeducted: {
  source: deductResult.source, // 新增: 'lingshi_free' | 'lingshi_bonus'
  reason: deductResult.reason,
  lingshiDeducted: deductResult.lingshiDeducted, // 新增: 仅灵石扣减时有值
}
```

---

### 4️⃣ `doc/SYSTEM-GUIDE.md` (第 82-132 行)

**更新部分**:

1. **优先级说明**

   ```
   4. 灵石扣减（配额全部用尽时）
      - 4.1 优先扣减「免费次数对应的灵石」（100 灵石/次）
      - 4.2 再扣减「赠送配额对应的灵石」（100 灵石/次）
   ```

2. **灵石消耗价格表**

   ```
   排卦消耗：
     - 免费次数灵石成本：100 灵石/次
     - 赠送配额灵石成本：100 灵石/次
   ```

3. **配额检查流程图更新**

   ```
   └─ 否 → 检查配额状态
      ├─ ... (现有的)
      ├─ 灵石足够兑换免费次数？→ canDivine=true（100灵石）
      ├─ 灵石足够兑换赠送配额？→ canDivine=true（100灵石）
      └─ 都没有？→ canDivine=false（提示需要灵石）
   ```

---

## 📊 核心数据流

### 排卦扣减流程（新增灵石扣减）

```
POST /api/divination/divine
  ↓
deductQuota(userId)
  ↓
  ├─ [1] 会员免费？ → YES: 返回 'membership'
  ├─ [2] dailyFreeQuota > 0？ → YES: 扣减, 返回 'daily_free'
  ├─ [3] bonusQuota > 0？ → YES: 扣减, 返回 'bonus_quota'
  ├─ [4.1] lingshi >= 100 (免费)？ → YES: 扣减, 返回 'lingshi_free' ✨ NEW
  ├─ [4.2] lingshi >= 100 (赠送)？ → YES: 扣减, 返回 'lingshi_bonus' ✨ NEW
  └─ 都失败 → 返回失败，提示灵石不足
  ↓
响应 {
  quotaDeducted: {
    source: 'lingshi_free' | 'lingshi_bonus',  // 新增值
    reason: '...',
    lingshiDeducted: 100  // 新增字段
  }
}
```

---

## 🧪 测试验证

### 新增测试文件

1. **test-lingshi-deduction.sql** - SQL 测试脚本
   - 6 个测试场景
   - 可直接在数据库执行
   - 包含数据准备和验证SQL

2. **LINGSHI-DEDUCTION-TEST.md** - 测试指南
   - 快速开始说明
   - 3 个完整的 API 测试场景
   - Curl 命令示例
   - 预期响应示例

---

## ⚙️ 技术要点

### 并发安全

所有灵石更新都使用 WHERE 条件：

```typescript
.where(and(eq(users.id, userId), gte(users.lingshi, cost)))
```

### 类型安全

新字段都是可选的，保持向后兼容：

- `lingshiDeducted?: number`

### 数据库优化

- 使用现有字段，无须迁移
- WHERE 条件可利用索引
- 更新操作次数无增加

---

## 🔄 改动总结表

| 层级 | 改动数 | 文件数 | 详情 |
|------|-------|--------|------|
| 配置层 | 2个常数 | 1个 | lingshi.ts |
| 业务逻辑 | 2个函数 | 1个 | quota.ts |
| API响应 | 1个响应结构 | 1个 | quota-check.ts |
| 文档 | 1个区块 | 1个 | SYSTEM-GUIDE.md |
| **测试** | **2个文件** | **2个** | **SQL + MD** |
| **实现文档** | **1个文件** | **1个** | **IMPL.md** |
| **总计** | **多项** | **7个** | **全覆盖** |

---

## ✅ 验收清单

- [x] 代码改动完成
- [x] 并发安全检查
- [x] 类型兼容性检查
- [x] API 响应文档更新
- [x] 系统文档同步更新
- [x] SQL 测试脚本编写
- [x] 测试指南编写
- [x] 实现细节文档

---

## 📌 快速参考

### 改动后的优先级

```
1. 会员免费       (source: 'membership')
2. 每日免费配额   (source: 'daily_free')
3. 赠送配额       (source: 'bonus_quota')
4. 免费灵石       (source: 'lingshi_free')      ← NEW
5. 赠送灵石       (source: 'lingshi_bonus')     ← NEW
```

### 灵石消耗成本

```
divineFreeCost:  100 灵石 (免费次数对应)
divineBonus:     100 灵石 (赠送配额对应)
```

### 响应示例

```json
{
  "quotaDeducted": {
    "source": "lingshi_free",
    "reason": "灵石扣减（免费次数）：消耗 100 灵石",
    "lingshiDeducted": 100
  }
}
```

---

## 📚 相关链接

- 详细实现：`LINGSHI-DEDUCTION-IMPL.md`
- 快速测试：`LINGSHI-DEDUCTION-TEST.md`
- SQL 脚本：`test-lingshi-deduction.sql`
- 系统文档：`doc/SYSTEM-GUIDE.md`
- 配置文件：`src/config/lingshi.ts`
