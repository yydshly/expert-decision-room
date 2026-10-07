CREATE TABLE `execution_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`grant_id` text NOT NULL,
	`run_id` text NOT NULL,
	`arm` text NOT NULL,
	`input_bytes` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`result_json` text
);
--> statement-breakpoint
CREATE INDEX `idx_execution_calls_owner_grant` ON `execution_calls` (`owner`,`grant_id`);--> statement-breakpoint
CREATE TABLE `execution_grants` (
	`owner` text PRIMARY KEY NOT NULL,
	`grant_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`active_run` text,
	`calls_used` integer DEFAULT 0 NOT NULL,
	`input_bytes_used` integer DEFAULT 0 NOT NULL,
	`output_tokens_reserved` integer DEFAULT 0 NOT NULL,
	`last_call_at` integer DEFAULT 0 NOT NULL,
	`reservation_token` text
);
