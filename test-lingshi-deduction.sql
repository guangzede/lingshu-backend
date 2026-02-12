-- ============================================================================
-- 灵石扣减逻辑测试脚本
-- ============================================================================
-- 测试场景：验证排卦时灵石的扣减优先级
-- 
-- 扣减优先级：
-- 1. 会员免费 → 无需扣费
-- 2. 每日免费配额 (dailyFreeQuota > 0) → 扣减配额
-- 3. 赠送配额 (bonusQuota > 0) → 扣减配额
-- 4. 灵石扣减（配额全部用尽时）
--    4.1 优先扣减「免费次数对应的灵石」(100灵石/次)
--    4.2 再扣减「赠送配额对应的灵石」(100灵石/次)
-- ============================================================================

-- 测试用户 ID：创建或使用现有用户
-- 假设用户ID为 1

-- ============================================================================
-- 测试 1：准备初始状态（配额全部用尽，只有灵石）
-- ============================================================================
UPDATE users SET 
  lingshi = 500,                  -- 设置 500 灵石
  dailyFreeQuota = 0,             -- 每日免费配额全部用尽
  bonusQuota = 0,                 -- 赠送配额全部用尽
  memberLevel = 0,                -- 非会员
  memberExpireAt = 0,
  updatedAt = CURRENT_TIMESTAMP
WHERE id = 1;

-- 验证初始状态
SELECT id, lingshi, dailyFreeQuota, bonusQuota, memberLevel FROM users WHERE id = 1;

-- ============================================================================
-- 测试 2：排卦 1 次（扣减 100 灵石 → 免费次数对应的灵石）
-- ============================================================================
-- 调用 POST /api/divination/divine
-- 预期结果：
--   - source: 'lingshi_free'
--   - lingshi 从 500 → 400
--   - reason: '灵石扣减（免费次数）：消耗 100 灵石'

-- 手动验证：
UPDATE users SET lingshi = 400, updatedAt = CURRENT_TIMESTAMP WHERE id = 1;
SELECT id, lingshi, dailyFreeQuota, bonusQuota FROM users WHERE id = 1;

-- ============================================================================
-- 测试 3：再排卦 1 次（扣减 100 灵石 → 赠送配额对应的灵石）
-- ============================================================================
-- 调用 POST /api/divination/divine
-- 预期结果：
--   - source: 'lingshi_bonus'  (注意这里改为了赠送配额对应的成本)
--   - lingshi 从 400 → 300
--   - reason: '灵石扣减（赠送配额）：消耗 100 灵石'

UPDATE users SET lingshi = 300, updatedAt = CURRENT_TIMESTAMP WHERE id = 1;
SELECT id, lingshi, dailyFreeQuota, bonusQuota FROM users WHERE id = 1;

-- ============================================================================
-- 测试 4：灵石不足（300灵石，无法扣减 100 灵石）
-- ============================================================================
-- 此时灵石为 300，仍可以扣减
-- 但如果调整为 50 灵石：

UPDATE users SET lingshi = 50, updatedAt = CURRENT_TIMESTAMP WHERE id = 1;
-- 调用 POST /api/divination/divine
-- 预期结果：
--   - success: false
--   - reason: '配额已用尽，需要 100 灵石继续排卦，当前灵石：50'

-- ============================================================================
-- 测试 5：混合场景 - 有部分配额和灵石
-- ============================================================================
UPDATE users SET 
  lingshi = 200,
  dailyFreeQuota = 1,             -- 还有 1 次免费
  bonusQuota = 0,
  memberLevel = 0,
  updatedAt = CURRENT_TIMESTAMP
WHERE id = 1;

-- 第 1 次排卦：扣减 dailyFreeQuota（1 → 0）
-- 第 2 次排卦：扣减灵石 → 'lingshi_free'（200 → 100）
-- 第 3 次排卦：扣减灵石 → 'lingshi_bonus'（100 → 0）
-- 第 4 次排卦：失败（灵石不足）

-- ============================================================================
-- 测试 6：会员场景（会员免费，不扣减任何东西）
-- ============================================================================
UPDATE users SET 
  lingshi = 0,
  dailyFreeQuota = 0,
  bonusQuota = 0,
  memberLevel = 1,
  memberExpireAt = 9999999999999,  -- 远未来时间
  updatedAt = CURRENT_TIMESTAMP
WHERE id = 1;

-- 调用 POST /api/divination/divine
-- 预期结果：
--   - source: 'membership'
--   - 不消耗任何配额或灵石
--   - reason: '会员可用'

-- ============================================================================
-- 清理恢复测试
-- ============================================================================
-- 恢复用户初始状态
UPDATE users SET 
  lingshi = 0,
  dailyFreeQuota = 1,
  bonusQuota = 2,
  memberLevel = 0,
  memberExpireAt = 0,
  updatedAt = CURRENT_TIMESTAMP
WHERE id = 1;
