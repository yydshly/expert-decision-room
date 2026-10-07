CREATE TABLE `role_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`role` text NOT NULL,
	`base_version` integer NOT NULL,
	`config_json` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_role_proposals_owner_role` ON `role_proposals` (`owner`,`role`);--> statement-breakpoint
CREATE TABLE `role_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`role` text NOT NULL,
	`version` integer NOT NULL,
	`config_json` text NOT NULL,
	`proposal_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_role_versions_owner_role_version` ON `role_versions` (`owner`,`role`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_role_versions_proposal` ON `role_versions` (`proposal_id`);