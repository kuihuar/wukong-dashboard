CREATE TABLE `project_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','member','viewer') NOT NULL DEFAULT 'member',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`namespace` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quota_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`description` text,
	`maxVMs` int NOT NULL,
	`maxCPU` int NOT NULL,
	`maxMemoryGB` int NOT NULL,
	`maxStorageGB` int NOT NULL,
	`maxGPUs` int NOT NULL,
	`maxSnapshots` int NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quota_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `resource_quotas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`maxVMs` int NOT NULL DEFAULT 10,
	`maxCPU` int NOT NULL DEFAULT 32,
	`maxMemoryGB` int NOT NULL DEFAULT 64,
	`maxStorageGB` int NOT NULL DEFAULT 500,
	`maxGPUs` int NOT NULL DEFAULT 0,
	`maxSnapshots` int NOT NULL DEFAULT 20,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `resource_quotas_id` PRIMARY KEY(`id`),
	CONSTRAINT `resource_quotas_projectId_unique` UNIQUE(`projectId`)
);
--> statement-breakpoint
CREATE TABLE `resource_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`usedVMs` int NOT NULL DEFAULT 0,
	`usedCPU` int NOT NULL DEFAULT 0,
	`usedMemoryGB` int NOT NULL DEFAULT 0,
	`usedStorageGB` int NOT NULL DEFAULT 0,
	`usedGPUs` int NOT NULL DEFAULT 0,
	`usedSnapshots` int NOT NULL DEFAULT 0,
	`lastUpdated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `resource_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `resource_usage_projectId_unique` UNIQUE(`projectId`)
);
