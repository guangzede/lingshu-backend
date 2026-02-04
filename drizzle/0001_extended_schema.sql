-- 迁移: 扩展 users 表，新增配额、会员、推荐等字段

-- 第1步：创建临时表，复制现有数据
CREATE TABLE users_backup AS SELECT * FROM users;

-- 第2步：删除旧表
DROP TABLE users;

-- 第3步：创建新表（包含所有新字段）
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  daily_free_quota INTEGER DEFAULT 1,
  bonus_quota INTEGER DEFAULT 0,
  last_used_date INTEGER DEFAULT 0,
  lingshi INTEGER DEFAULT 0,
  member_level INTEGER DEFAULT 0,
  member_expire_at INTEGER DEFAULT 0,
  vip_expire INTEGER DEFAULT 0,
  referrer_id INTEGER,
  device_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(referrer_id) REFERENCES users(id)
);

-- 第4步：从备份表迁移数据，username使用 'user_' + id 作为初始值
INSERT INTO users (id, username, phone, password, daily_free_quota, bonus_quota, last_used_date, lingshi, member_level, member_expire_at, vip_expire, created_at, updated_at)
SELECT id, 'user_' || id, phone, password, 1, 0, 0, 0, 0, 0, vip_expire, created_at, created_at
FROM users_backup;

-- 第5步：删除备份表
DROP TABLE users_backup;

-- 第6步：创建 divination_records 表（排卦去重）
CREATE TABLE divination_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subject_hash TEXT NOT NULL,
  input_data TEXT,
  last_used_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 第7步：创建 referral_rewards 表（分享奖励日志）
CREATE TABLE referral_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id INTEGER NOT NULL,
  invitee_id INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  lingshi_awarded INTEGER DEFAULT 0,
  bonus_quota_awarded INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(referrer_id) REFERENCES users(id),
  FOREIGN KEY(invitee_id) REFERENCES users(id)
);

-- 创建索引以提升查询性能
CREATE INDEX idx_divination_records_user_id ON divination_records(user_id);
CREATE INDEX idx_divination_records_subject_hash ON divination_records(subject_hash);
CREATE INDEX idx_referral_rewards_referrer_id ON referral_rewards(referrer_id);
CREATE INDEX idx_referral_rewards_invitee_id ON referral_rewards(invitee_id);
