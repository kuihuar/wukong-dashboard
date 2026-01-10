CREATE TABLE `audit_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int,
	`eventType` varchar(64) NOT NULL,
	`description` text,
	`ipAddress` varchar(45),
	`userAgent` text,
	`metadata` json,
	`severity` enum('info','warning','error') NOT NULL DEFAULT 'info',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oidc_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`discoveryUrl` text NOT NULL,
	`clientId` varchar(255) NOT NULL,
	`clientSecret` varchar(255) NOT NULL,
	`redirectUri` text NOT NULL,
	`scopes` varchar(512) NOT NULL DEFAULT 'openid profile email',
	`enabled` boolean NOT NULL DEFAULT true,
	`isDefault` boolean NOT NULL DEFAULT false,
	`config` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oidc_providers_id` PRIMARY KEY(`id`),
	CONSTRAINT `oidc_providers_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `user_mfa_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totpSecret` varchar(255),
	`totpEnabled` boolean NOT NULL DEFAULT false,
	`backupCodes` json,
	`backupCodesGenerated` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_mfa_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_mfa_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_oidc_identities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`providerId` int NOT NULL,
	`subject` varchar(255) NOT NULL,
	`claims` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_oidc_identities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionToken` varchar(255) NOT NULL,
	`deviceName` varchar(128),
	`userAgent` text,
	`ipAddress` varchar(45),
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_sessions_sessionToken_unique` UNIQUE(`sessionToken`)
);
