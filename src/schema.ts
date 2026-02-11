import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 1. 用户表 (扩展版本 - 包含会员、配额、推荐等字段)
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(), // 登录账号（用户自定义）
  phone: text('phone').notNull().unique(), // 手机号（必填，用于找回）
  password: text('password').notNull(), // 密码（加密存储）
  
  // 配额管理字段
  dailyFreeQuota: integer('daily_free_quota').default(1), // 每日免费次数，默认1
  bonusQuota: integer('bonus_quota').default(0), // 额外赠送次数，上限5
  lastUsedDate: integer('last_used_date').default(0), // 上次使用配额的日期（YYYYMMDD格式），用于判定是否需要重置
  
  // 灵石系统
  lingshi: integer('lingshi').default(1000), // 灵石余额，默认1000
  
  // 会员等级
  memberLevel: integer('member_level').default(0), // 0=非会员，1=会员
  memberExpireAt: integer('member_expire_at').default(0), // 会员过期时间戳，0表示永不过期或未激活
  memberPurchasedAt: integer('member_purchased_at').default(0), // 购卡时间戳
  
  // VIP 兼容字段（保留用于迁移）
  vipExpire: integer('vip_expire').default(0), // VIP到期时间戳，默认0（逐步废弃，使用memberExpireAt替代）
  
  // 推荐系统
  referrerId: integer('referrer_id'), // 推荐人ID（可选）
  inviteCode: text('invite_code').unique(), // 邀请码（唯一）

  // 资料完善
  nickname: text('nickname'), // 称呼
  gender: text('gender'), // 性别
  birthday: text('birthday'), // 生日 YYYY-MM-DD
  profileCompletedAt: integer('profile_completed_at').default(0), // 完成资料时间戳
  
  // 风控字段
  deviceId: text('device_id'), // 设备指纹，注册时记录初次设备标识
  
  // 时间戳
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
});

// 2. 卦例表 (方案B：列化字段存储)
export const cases = sqliteTable('cases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id), // 关联用户ID
  
  // 起卦基本信息
  dateValue: text('date_value').notNull(), // YYYY-MM-DD
  timeValue: text('time_value').notNull(), // HH:mm
  ruleSetKey: text('rule_set_key').notNull(), // 排盘规则集
  question: text('question').notNull().default(''), // 求测事项
  remark: text('remark'), // 备注
  manualMode: integer('manual_mode').notNull().default(0), // 0=自动 1=手动
  
  // 爻位信息（JSON数组序列化，6个爻）
  lines: text('lines').notNull(), // JSON.stringify([{isYang, isMoving}, ...])
  
  // 卦象名称（便于列表展示和搜索）
  baseHexName: text('base_hex_name'), // 本卦名称
  variantHexName: text('variant_hex_name'), // 变卦名称
  
  // 完整排盘结果（JSON存储，包含所有推演细节）
  result: text('result'), // JSON.stringify(computeAll result)
  
  // 时间戳
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
});

// 3. 排卦记录表 (用于5分钟内去重检查)
export const divinationRecords = sqliteTable('divination_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id), // 用户ID
  subjectHash: text('subject_hash').notNull(), // SHA256(userId + subject + category) 去重哈希
  inputData: text('input_data'), // 脱敏后的起卦参数（JSON格式），便于后期数据一致性排查
  lastUsedAt: integer('last_used_at').$defaultFn(() => Date.now()), // 最后一次使用时间戳
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
});

// 4. 分享奖励日志表 (记录推荐关系和奖励发放)
export const referralRewards = sqliteTable('referral_rewards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  referrerId: integer('referrer_id').notNull().references(() => users.id), // 推荐人ID
  inviteeId: integer('invitee_id').notNull().references(() => users.id), // 被推荐人ID
  rewardType: text('reward_type').notNull(), // 'lingshi' | 'bonus_quota'
  lingshiAwarded: integer('lingshi_awarded').default(0), // 如果是灵石奖励，记录数量
  bonusQuotaAwarded: integer('bonus_quota_awarded').default(0), // 如果是配额奖励，记录数量
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
});