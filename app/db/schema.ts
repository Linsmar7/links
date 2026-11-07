import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  primaryKey,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Custom bytea type for storing binary image data
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return 'bytea';
  },
});

export const links = pgTable(
  'links',
  {
    id: serial('id').primaryKey(),
    url: text('url').notNull(),
    urlKey: text('url_key').notNull().unique(),
    platform: varchar('platform', { length: 30 }).notNull().default('outro'),
    title: text('title'),
    description: text('description'),
    author: text('author'),
    siteName: text('site_name'),
    previewStatus: varchar('preview_status', { length: 20 })
      .notNull()
      .default('pendente'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('links_created_at_idx').on(table.createdAt),
    index('links_platform_idx').on(table.platform),
    index('links_preview_status_idx').on(table.previewStatus),
  ]
);

export const thumbnails = pgTable('thumbnails', {
  linkId: integer('link_id')
    .primaryKey()
    .references(() => links.id, { onDelete: 'cascade' }),
  data: bytea('data').notNull(),
  mime: varchar('mime', { length: 50 }).notNull().default('image/jpeg'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const people = pgTable('people', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const linkPeople = pgTable(
  'link_people',
  {
    linkId: integer('link_id')
      .notNull()
      .references(() => links.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.linkId, table.personId] }),
    index('link_people_person_idx').on(table.personId),
  ]
);

export const linkTags = pgTable(
  'link_tags',
  {
    linkId: integer('link_id')
      .notNull()
      .references(() => links.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.linkId, table.tagId] }),
    index('link_tags_tag_idx').on(table.tagId),
  ]
);

// Relations
export const linksRelations = relations(links, ({ one, many }) => ({
  thumbnail: one(thumbnails, {
    fields: [links.id],
    references: [thumbnails.linkId],
  }),
  linkPeople: many(linkPeople),
  linkTags: many(linkTags),
}));

export const thumbnailsRelations = relations(thumbnails, ({ one }) => ({
  link: one(links, {
    fields: [thumbnails.linkId],
    references: [links.id],
  }),
}));

export const peopleRelations = relations(people, ({ many }) => ({
  linkPeople: many(linkPeople),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  linkTags: many(linkTags),
}));

export const linkPeopleRelations = relations(linkPeople, ({ one }) => ({
  link: one(links, {
    fields: [linkPeople.linkId],
    references: [links.id],
  }),
  person: one(people, {
    fields: [linkPeople.personId],
    references: [people.id],
  }),
}));

export const linkTagsRelations = relations(linkTags, ({ one }) => ({
  link: one(links, {
    fields: [linkTags.linkId],
    references: [links.id],
  }),
  tag: one(tags, {
    fields: [linkTags.tagId],
    references: [tags.id],
  }),
}));

