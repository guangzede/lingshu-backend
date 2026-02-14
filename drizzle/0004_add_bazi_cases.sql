CREATE TABLE `bazi_cases` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `name` text,
  `note` text,
  `birth_date` text,
  `birth_time` text,
  `calendar` text,
  `time_mode` text,
  `gender` text,
  `manual_mode` integer DEFAULT 0 NOT NULL,
  `pillars` text NOT NULL,
  `options` text,
  `result` text,
  `created_at` integer,
  `updated_at` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
