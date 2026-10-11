CREATE TABLE `participants` (
	`id` varchar(36) NOT NULL,
	`room_id` varchar(36) NOT NULL,
	`name` varchar(60) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`is_host` boolean NOT NULL DEFAULT false,
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `participants_token_unique` UNIQUE(`token_hash`),
	CONSTRAINT `participants_id_room_unique` UNIQUE(`id`,`room_id`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`active_position` int unsigned NOT NULL DEFAULT 0,
	`revealed` boolean NOT NULL DEFAULT false,
	`finished` boolean NOT NULL DEFAULT false,
	`revision` int unsigned NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` varchar(36) NOT NULL,
	`room_id` varchar(36) NOT NULL,
	`title` varchar(240) NOT NULL,
	`position` int unsigned NOT NULL,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `tasks_room_position_unique` UNIQUE(`room_id`,`position`),
	CONSTRAINT `tasks_id_room_unique` UNIQUE(`id`,`room_id`)
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`id` varchar(36) NOT NULL,
	`room_id` varchar(36) NOT NULL,
	`task_id` varchar(36) NOT NULL,
	`participant_id` varchar(36) NOT NULL,
	`value` enum('0','1','2','3','5','8','13','21','?','coffee') NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `votes_id` PRIMARY KEY(`id`),
	CONSTRAINT `votes_task_participant_unique` UNIQUE(`task_id`,`participant_id`)
);
--> statement-breakpoint
ALTER TABLE `participants` ADD CONSTRAINT `participants_room_id_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_room_id_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `votes` ADD CONSTRAINT `votes_task_room_fk` FOREIGN KEY (`task_id`,`room_id`) REFERENCES `tasks`(`id`,`room_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `votes` ADD CONSTRAINT `votes_participant_room_fk` FOREIGN KEY (`participant_id`,`room_id`) REFERENCES `participants`(`id`,`room_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `participants_room_presence_idx` ON `participants` (`room_id`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `votes_task_room_idx` ON `votes` (`task_id`,`room_id`);--> statement-breakpoint
CREATE INDEX `votes_participant_room_idx` ON `votes` (`participant_id`,`room_id`);