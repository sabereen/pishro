CREATE TABLE `auth_sessions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_session_token_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `daily_report_tasks` (
	`id` varchar(36) NOT NULL,
	`report_id` varchar(36) NOT NULL,
	`task_id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	CONSTRAINT `daily_report_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_task_unique` UNIQUE(`report_id`,`task_id`)
);
--> statement-breakpoint
CREATE TABLE `daily_reports` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`sprint_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`date` date NOT NULL,
	`yesterday` text NOT NULL,
	`today` text NOT NULL,
	`blockers` text NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `daily_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_sprint_user_date_unique` UNIQUE(`sprint_id`,`user_id`,`date`),
	CONSTRAINT `daily_id_project_unique` UNIQUE(`id`,`project_id`)
);
--> statement-breakpoint
CREATE TABLE `estimate_history` (
	`id` varchar(36) NOT NULL,
	`session_task_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`previous_point` int unsigned,
	`point` int unsigned NOT NULL,
	`reason` enum('accepted','calibrated') NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `estimate_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `poker_participants` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`joined_at` timestamp,
	`last_seen_at` timestamp,
	CONSTRAINT `poker_participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `poker_participant_unique` UNIQUE(`session_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `poker_session_tasks` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`task_id` varchar(36) NOT NULL,
	`position` int unsigned NOT NULL,
	`status` enum('pending','active','estimated') NOT NULL DEFAULT 'pending',
	`final_point` int unsigned,
	`round` int unsigned NOT NULL DEFAULT 1,
	CONSTRAINT `poker_session_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `poker_task_unique` UNIQUE(`session_id`,`task_id`),
	CONSTRAINT `poker_task_position_unique` UNIQUE(`session_id`,`position`)
);
--> statement-breakpoint
CREATE TABLE `poker_sessions` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`sprint_id` varchar(36),
	`name` varchar(120) NOT NULL,
	`facilitator_id` varchar(36) NOT NULL,
	`status` enum('draft','lobby','voting','reveal','review','finalized') NOT NULL DEFAULT 'draft',
	`active_position` int unsigned NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 0,
	`cards` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `poker_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `poker_session_id_project_unique` UNIQUE(`id`,`project_id`)
);
--> statement-breakpoint
CREATE TABLE `poker_votes` (
	`id` varchar(36) NOT NULL,
	`session_task_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`round` int unsigned NOT NULL,
	`value` varchar(10) NOT NULL,
	CONSTRAINT `poker_votes_id` PRIMARY KEY(`id`),
	CONSTRAINT `poker_vote_round_user_unique` UNIQUE(`session_task_id`,`round`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `project_invites` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `project_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `invite_token_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` enum('admin','member') NOT NULL DEFAULT 'member',
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `project_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `members_project_user_unique` UNIQUE(`project_id`,`user_id`),
	CONSTRAINT `members_user_project_unique` UNIQUE(`user_id`,`project_id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`settings` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pull_requests` (
	`id` varchar(36) NOT NULL,
	`task_id` varchar(36) NOT NULL,
	`repository` varchar(220) NOT NULL,
	`number` int unsigned NOT NULL,
	`title` varchar(500) NOT NULL,
	`url` varchar(500) NOT NULL,
	`status` enum('open','draft','closed','merged') NOT NULL,
	`fetched_at` timestamp NOT NULL,
	CONSTRAINT `pull_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `pull_request_task_url_unique` UNIQUE(`task_id`,`url`)
);
--> statement-breakpoint
CREATE TABLE `sprint_point_events` (
	`id` varchar(36) NOT NULL,
	`sprint_id` varchar(36) NOT NULL,
	`task_id` varchar(36),
	`delta` int NOT NULL,
	`occurred_at` timestamp(3) NOT NULL,
	CONSTRAINT `sprint_point_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sprints` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`status` enum('planned','active','completed') NOT NULL DEFAULT 'planned',
	`working_days` json NOT NULL,
	`started_at` timestamp(3),
	`active_project_id` varchar(36) GENERATED ALWAYS AS (case when status = 'active' then project_id else null end) VIRTUAL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `sprints_id` PRIMARY KEY(`id`),
	CONSTRAINT `sprints_id_project_unique` UNIQUE(`id`,`project_id`),
	CONSTRAINT `sprints_one_active_unique` UNIQUE(`active_project_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`email` varchar(254) NOT NULL,
	`password_hash` varchar(256) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `work_items` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`sprint_id` varchar(36),
	`assignee_id` varchar(36),
	`title` varchar(240) NOT NULL,
	`description` text NOT NULL,
	`point` int unsigned,
	`status` enum('todo','in_progress','review','done') NOT NULL DEFAULT 'todo',
	`priority` enum('low','normal','high') NOT NULL DEFAULT 'normal',
	`rank` int NOT NULL,
	`sprint_assigned_at` timestamp(3),
	`done_at` timestamp,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`revision` int unsigned NOT NULL DEFAULT 0,
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `work_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `work_items_id_project_unique` UNIQUE(`id`,`project_id`)
);
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_report_tasks` ADD CONSTRAINT `daily_tasks_report_fk` FOREIGN KEY (`report_id`,`project_id`) REFERENCES `daily_reports`(`id`,`project_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_report_tasks` ADD CONSTRAINT `daily_tasks_work_item_fk` FOREIGN KEY (`task_id`,`project_id`) REFERENCES `work_items`(`id`,`project_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD CONSTRAINT `daily_reports_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD CONSTRAINT `daily_sprint_project_fk` FOREIGN KEY (`sprint_id`,`project_id`) REFERENCES `sprints`(`id`,`project_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `estimate_history` ADD CONSTRAINT `estimate_history_session_task_id_poker_session_tasks_id_fk` FOREIGN KEY (`session_task_id`) REFERENCES `poker_session_tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `estimate_history` ADD CONSTRAINT `estimate_history_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `poker_participants` ADD CONSTRAINT `poker_participants_session_id_poker_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `poker_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `poker_participants` ADD CONSTRAINT `poker_participants_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `poker_session_tasks` ADD CONSTRAINT `poker_task_session_project_fk` FOREIGN KEY (`session_id`,`project_id`) REFERENCES `poker_sessions`(`id`,`project_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `poker_session_tasks` ADD CONSTRAINT `poker_task_work_item_fk` FOREIGN KEY (`task_id`,`project_id`) REFERENCES `work_items`(`id`,`project_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `poker_sessions` ADD CONSTRAINT `poker_sessions_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `poker_sessions` ADD CONSTRAINT `poker_sessions_facilitator_id_users_id_fk` FOREIGN KEY (`facilitator_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `poker_sessions` ADD CONSTRAINT `poker_sprint_project_fk` FOREIGN KEY (`sprint_id`,`project_id`) REFERENCES `sprints`(`id`,`project_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `poker_votes` ADD CONSTRAINT `poker_votes_session_task_id_poker_session_tasks_id_fk` FOREIGN KEY (`session_task_id`) REFERENCES `poker_session_tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `poker_votes` ADD CONSTRAINT `poker_votes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_invites` ADD CONSTRAINT `project_invites_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD CONSTRAINT `pull_requests_task_id_work_items_id_fk` FOREIGN KEY (`task_id`) REFERENCES `work_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sprint_point_events` ADD CONSTRAINT `sprint_point_events_sprint_id_sprints_id_fk` FOREIGN KEY (`sprint_id`) REFERENCES `sprints`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sprint_point_events` ADD CONSTRAINT `sprint_point_events_task_id_work_items_id_fk` FOREIGN KEY (`task_id`) REFERENCES `work_items`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sprints` ADD CONSTRAINT `sprints_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_items` ADD CONSTRAINT `work_items_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_items` ADD CONSTRAINT `work_items_sprint_project_fk` FOREIGN KEY (`sprint_id`,`project_id`) REFERENCES `sprints`(`id`,`project_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_items` ADD CONSTRAINT `work_items_member_project_fk` FOREIGN KEY (`assignee_id`,`project_id`) REFERENCES `project_members`(`user_id`,`project_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auth_session_expiry_idx` ON `auth_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `estimate_history_task_idx` ON `estimate_history` (`session_task_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `poker_project_status_idx` ON `poker_sessions` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `invites_project_idx` ON `project_invites` (`project_id`);--> statement-breakpoint
CREATE INDEX `members_user_idx` ON `project_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `sprint_events_time_idx` ON `sprint_point_events` (`sprint_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `sprints_project_status_idx` ON `sprints` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `work_items_backlog_idx` ON `work_items` (`project_id`,`rank`);--> statement-breakpoint
CREATE INDEX `work_items_sprint_status_idx` ON `work_items` (`sprint_id`,`status`);--> statement-breakpoint
CREATE INDEX `work_items_assignee_idx` ON `work_items` (`assignee_id`,`project_id`);