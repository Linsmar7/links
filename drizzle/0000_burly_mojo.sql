CREATE TABLE "link_people" (
	"link_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	CONSTRAINT "link_people_link_id_person_id_pk" PRIMARY KEY("link_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "link_tags" (
	"link_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "link_tags_link_id_tag_id_pk" PRIMARY KEY("link_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"url_key" text NOT NULL,
	"platform" varchar(30) DEFAULT 'outro' NOT NULL,
	"title" text,
	"description" text,
	"author" text,
	"site_name" text,
	"preview_status" varchar(20) DEFAULT 'pendente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_url_key_unique" UNIQUE("url_key")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "thumbnails" (
	"link_id" integer PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"mime" varchar(50) DEFAULT 'image/jpeg' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "link_people" ADD CONSTRAINT "link_people_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_people" ADD CONSTRAINT "link_people_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_tags" ADD CONSTRAINT "link_tags_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_tags" ADD CONSTRAINT "link_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thumbnails" ADD CONSTRAINT "thumbnails_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_people_person_idx" ON "link_people" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "link_tags_tag_idx" ON "link_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "links_created_at_idx" ON "links" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "links_platform_idx" ON "links" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "links_preview_status_idx" ON "links" USING btree ("preview_status");