CREATE TABLE "builds" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"spec" jsonb NOT NULL,
	"external_id" text,
	"queue_position" integer,
	"log_url" text,
	"artifact_url" text,
	"artifact_expires_at" timestamp with time zone,
	"failure_reason" text,
	"quota_refunded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "quota_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"github_login" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota" ADD CONSTRAINT "quota_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_builds_user_id" ON "builds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_builds_status" ON "builds" USING btree ("status");