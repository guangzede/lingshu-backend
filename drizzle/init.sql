-- 创建 users 表
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`phone` text NOT NULL,
	`password` text NOT NULL,
	`daily_free_quota` integer DEFAULT 1,
	`bonus_quota` integer DEFAULT 0,
	`last_used_date` integer DEFAULT 0,
	`lingshi` integer DEFAULT 1000,
	`member_level` integer DEFAULT 0,
	`member_expire_at` integer DEFAULT 0,
	`member_purchased_at` integer DEFAULT 0,
	`vip_expire` integer DEFAULT 0,
	`referrer_id` integer,
	`invite_code` text,
	`nickname` text,
	`gender` text,
	`birthday` text,
	`profile_completed_at` integer DEFAULT 0,
	`device_id` text,
	`created_at` integer,
	`updated_at` integer
);

-- 创建唯一索引
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);
CREATE UNIQUE INDEX `users_invite_code_unique` ON `users` (`invite_code`);

-- 创建 cases 表
CREATE TABLE `cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`title` text,
	`gua_data` text,
	`note` text,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

-- 创建 divination_records 表
CREATE TABLE `divination_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`subject_hash` text NOT NULL,
	`input_data` text,
	`last_used_at` integer,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

-- 创建 referral_rewards 表
CREATE TABLE `referral_rewards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`referrer_id` integer NOT NULL,
	`invitee_id` integer NOT NULL,
	`reward_type` text NOT NULL,
	`lingshi_awarded` integer DEFAULT 0,
	`bonus_quota_awarded` integer DEFAULT 0,
	`created_at` integer,
	FOREIGN KEY (`referrer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invitee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);