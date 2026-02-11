PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date_value` text NOT NULL,
	`time_value` text NOT NULL,
	`rule_set_key` text NOT NULL,
	`question` text DEFAULT '' NOT NULL,
	`remark` text,
	`manual_mode` integer DEFAULT 0 NOT NULL,
	`lines` text NOT NULL,
	`base_hex_name` text,
	`variant_hex_name` text,
	`result` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_cases`("id", "user_id", "date_value", "time_value", "rule_set_key", "question", "remark", "manual_mode", "lines", "base_hex_name", "variant_hex_name", "result", "created_at", "updated_at") SELECT "id", "user_id", "date_value", "time_value", "rule_set_key", "question", "remark", "manual_mode", "lines", "base_hex_name", "variant_hex_name", "result", "created_at", "updated_at" FROM `cases`;--> statement-breakpoint
DROP TABLE `cases`;--> statement-breakpoint
ALTER TABLE `__new_cases` RENAME TO `cases`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_users` (
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
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "phone", "password", "daily_free_quota", "bonus_quota", "last_used_date", "lingshi", "member_level", "member_expire_at", "member_purchased_at", "vip_expire", "referrer_id", "invite_code", "nickname", "gender", "birthday", "profile_completed_at", "device_id", "created_at", "updated_at") SELECT "id", "username", "phone", "password", "daily_free_quota", "bonus_quota", "last_used_date", "lingshi", "member_level", "member_expire_at", "member_purchased_at", "vip_expire", "referrer_id", "invite_code", "nickname", "gender", "birthday", "profile_completed_at", "device_id", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_invite_code_unique` ON `users` (`invite_code`);