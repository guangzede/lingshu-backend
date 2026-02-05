CREATE TABLE `divination_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`subject_hash` text NOT NULL,
	`input_data` text,
	`last_used_at` integer,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`phone` text NOT NULL,
	`password` text NOT NULL,
	`daily_free_quota` integer DEFAULT 1,
	`bonus_quota` integer DEFAULT 0,
	`last_used_date` integer DEFAULT 0,
	`lingshi` integer DEFAULT 0,
	`member_level` integer DEFAULT 0,
	`member_expire_at` integer DEFAULT 0,
	`vip_expire` integer DEFAULT 0,
	`referrer_id` integer,
	`device_id` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "phone", "password", "daily_free_quota", "bonus_quota", "last_used_date", "lingshi", "member_level", "member_expire_at", "vip_expire", "referrer_id", "device_id", "created_at", "updated_at") SELECT "id", "username", "phone", "password", "daily_free_quota", "bonus_quota", "last_used_date", "lingshi", "member_level", "member_expire_at", "vip_expire", "referrer_id", "device_id", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);