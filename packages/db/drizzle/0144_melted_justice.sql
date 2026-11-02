CREATE TABLE "automation_run_preparations" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_run_preparations" ADD CONSTRAINT "automation_run_preparations_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_run_preparations" ADD CONSTRAINT "automation_run_preparations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_run_preparations_org_created_by_idx" ON "automation_run_preparations" USING btree ("organization_id","created_by");