-- 迁移: 新增资料字段与购卡时间

ALTER TABLE users ADD COLUMN member_purchased_at INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN nickname TEXT;
ALTER TABLE users ADD COLUMN gender TEXT;
ALTER TABLE users ADD COLUMN birthday TEXT;
ALTER TABLE users ADD COLUMN profile_completed_at INTEGER DEFAULT 0;
