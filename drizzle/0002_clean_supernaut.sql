CREATE TABLE `experiment_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`experiment_id` text NOT NULL,
	`kind` text NOT NULL,
	`arm` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_experiment_entries_owner_experiment` ON `experiment_entries` (`owner`,`experiment_id`);--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`plan_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_experiments_owner_created` ON `experiments` (`owner`,`created_at`);