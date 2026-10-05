import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AssetPayload, DNA, Direction } from "@/lib/creative/engine";

export const properties = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  propertyType: text("property_type").notNull(),
  price: text("price").notNull(),
  audience: text("audience").notNull().default(""),
  amenities: text("amenities").notNull().default(""),
  description: text("description").notNull().default(""),
  objective: text("objective").notNull().default(""),
  source: text("source").notNull().default("samples"),
  sourceUrl: text("source_url").notNull().default(""),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const propertyImages = pgTable("property_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),
  url: text("url").notNull(),
  label: text("label").notNull().default(""),
  kind: text("kind").notNull().default("photo"),
  sort: integer("sort").notNull().default(0),
});

export const propertyDna = pgTable("property_dna", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  data: jsonb("data").$type<DNA>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  preset: text("preset").notNull(),
  presetLabel: text("preset_label").notNull().default(""),
  platforms: jsonb("platforms").$type<string[]>().notNull().default([]),
  options: jsonb("options").$type<Direction[]>().notNull().default([]),
  direction: jsonb("direction").$type<Direction>(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .references(() => campaigns.id, { onDelete: "cascade" })
    .notNull(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),
  kind: text("kind").notNull(),
  platform: text("platform").notNull(),
  aspect: text("aspect").notNull().default("4:5"),
  title: text("title").notNull().default(""),
  payload: jsonb("payload").$type<AssetPayload>().notNull(),
  score: integer("score").notNull().default(0),
  checks: jsonb("checks").$type<{ label: string; pass: boolean }[]>().notNull().default([]),
  status: text("status").notNull().default("review"),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const generations = pgTable("generations", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull(),
  model: text("model").notNull().default(""),
  status: text("status").notNull().default("success"),
  durationMs: integer("duration_ms").notNull().default(0),
  costCents: integer("cost_cents").notNull().default(0),
  campaignId: uuid("campaign_id"),
  propertyId: uuid("property_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export type Property = typeof properties.$inferSelect;
export type PropertyImage = typeof propertyImages.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Generation = typeof generations.$inferSelect;
