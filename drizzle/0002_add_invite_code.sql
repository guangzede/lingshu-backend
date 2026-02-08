-- 迁移: 新增邀请码字段

ALTER TABLE users ADD COLUMN invite_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_invite_code_unique ON users(invite_code);
