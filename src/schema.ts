import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 1. 用户表
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  phone: text('phone').notNull().unique(), // 手机号
  password: text('password').notNull(),    // 密码
  vipExpire: integer('vip_expire').default(0), // VIP到期时间戳，默认0
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
});

// 2. 卦例表 (存排盘数据)
export const cases = sqliteTable('cases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id), // 关联用户ID
  title: text('title'),
  guaData: text('gua_data'), // 存 JSON 字符串
  note: text('note'),
  updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
});