ALTER TABLE `poker_session_tasks` ADD `ignored_user_ids` json;
--> statement-breakpoint
UPDATE `poker_session_tasks` SET `ignored_user_ids` = JSON_ARRAY();
--> statement-breakpoint
ALTER TABLE `poker_session_tasks` MODIFY COLUMN `ignored_user_ids` json NOT NULL;
--> statement-breakpoint
ALTER TABLE `poker_session_tasks` ADD `revote_required` int unsigned DEFAULT 0 NOT NULL;
