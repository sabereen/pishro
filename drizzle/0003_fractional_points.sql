ALTER TABLE `estimate_history` MODIFY COLUMN `previous_point` decimal(11,1) unsigned;--> statement-breakpoint
ALTER TABLE `estimate_history` MODIFY COLUMN `point` decimal(11,1) unsigned NOT NULL;--> statement-breakpoint
ALTER TABLE `poker_session_tasks` MODIFY COLUMN `final_point` decimal(11,1) unsigned;--> statement-breakpoint
ALTER TABLE `sprint_point_events` MODIFY COLUMN `delta` decimal(11,1) NOT NULL;--> statement-breakpoint
ALTER TABLE `work_items` MODIFY COLUMN `point` decimal(11,1) unsigned;
--> statement-breakpoint
-- Refresh stale decks in open sessions; archived decks and all vote history remain intact.
UPDATE `poker_sessions` AS `session`
INNER JOIN `projects` AS `project` ON `project`.`id` = `session`.`project_id`
SET `session`.`cards` = JSON_EXTRACT(`project`.`settings`, '$.cards'),
    `session`.`revision` = `session`.`revision` + 1
WHERE `session`.`status` <> 'finalized'
  AND JSON_TYPE(JSON_EXTRACT(`project`.`settings`, '$.cards')) = 'ARRAY'
  AND NOT (`session`.`cards` <=> JSON_EXTRACT(`project`.`settings`, '$.cards'));
