CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`created_at` integer NOT NULL
);
