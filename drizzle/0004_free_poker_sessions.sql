ALTER TABLE `poker_sessions` ADD `mode` enum('tasks','free') DEFAULT 'tasks' NOT NULL;--> statement-breakpoint
ALTER TABLE `poker_sessions` ADD `free_round` json;